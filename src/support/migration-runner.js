import fs from "node:fs";
import path from "node:path";

export class MigrationRunner {
  constructor(database, migrationPath) {
    this.database = database;
    this.migrationPath = migrationPath;
  }

  async migrate() {
    await this.database.execAsync(buildMigrationsTableSql(this.database.client));

    if (!fs.existsSync(this.migrationPath)) {
      return;
    }

    const files = fs.readdirSync(this.migrationPath)
      .filter((file) => file.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
      const existing = await this.database.getAsync(
        "SELECT COUNT(*) AS count FROM migrations WHERE filename = :filename",
        { filename: file }
      );

      if ((existing?.count ?? 0) > 0) {
        continue;
      }

      const sql = fs.readFileSync(path.join(this.migrationPath, file), "utf8");
      await this.database.withTransaction(async (database) => {
        await executeMigrationSql(database, sql);
        await database.runAsync(
          "INSERT INTO migrations (filename, executed_at) VALUES (:filename, :executed_at)",
          {
            filename: file,
            executed_at: new Date().toISOString()
          }
        );
      });
    }
  }
}

function buildMigrationsTableSql(client) {
  if (client === "postgres") {
    return `
      CREATE TABLE IF NOT EXISTS migrations (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL
      )
    `;
  }

  return `
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL
    )
  `;
}

async function executeMigrationSql(database, sql) {
  if (database.client !== "sqlite") {
    await database.execAsync(sql);
    return;
  }

  const statements = sql
    .split(/;\s*(?:\r?\n|$)/u)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      await database.execAsync(`${statement};`);
    } catch (error) {
      if (isIgnorableSqliteAlterError(error)) {
        continue;
      }
      throw error;
    }
  }
}

function isIgnorableSqliteAlterError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("duplicate column name:");
}
