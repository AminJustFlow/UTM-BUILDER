import { syncAll, syncRun } from "../support/database.js";

export class UtmValueAcknowledgementRepository {
  constructor(database) {
    this.database = database;
  }

  list() {
    return syncAll(this.database, `
      SELECT *
      FROM utm_value_acknowledgements
      ORDER BY field ASC, value ASC
    `);
  }

  async listAsync() {
    if (typeof this.database.allAsync !== "function") {
      return this.list();
    }
    return await this.database.allAsync(`
      SELECT *
      FROM utm_value_acknowledgements
      ORDER BY field ASC, value ASC
    `);
  }

  acknowledge({ field, value, userId = null, userName = null, createdAt = new Date().toISOString() }) {
    return syncRun(this.database, this.insertSql(), this.insertParams({ field, value, userId, userName, createdAt }));
  }

  async acknowledgeAsync({ field, value, userId = null, userName = null, createdAt = new Date().toISOString() }) {
    if (typeof this.database.runAsync !== "function") {
      return this.acknowledge({ field, value, userId, userName, createdAt });
    }
    return await this.database.runAsync(this.insertSql(), this.insertParams({ field, value, userId, userName, createdAt }));
  }

  insertSql() {
    const isPostgres = this.database.client === "postgres";
    const prefix = isPostgres ? "INSERT" : "INSERT OR IGNORE";
    const conflictClause = isPostgres ? "\n      ON CONFLICT (field, value) DO NOTHING" : "";
    return `
      ${prefix} INTO utm_value_acknowledgements (
        field,
        value,
        acknowledged_by_user_id,
        acknowledged_by_name,
        created_at
      ) VALUES (
        :field,
        :value,
        :acknowledged_by_user_id,
        :acknowledged_by_name,
        :created_at
      )${conflictClause}
    `;
  }

  insertParams({ field, value, userId, userName, createdAt }) {
    return {
      field: String(field ?? "").trim(),
      value: String(value ?? "").trim(),
      acknowledged_by_user_id: userId ?? null,
      acknowledged_by_name: userName ?? null,
      created_at: createdAt
    };
  }
}
