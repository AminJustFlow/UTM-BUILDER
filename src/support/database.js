import fs from "node:fs";
import path from "node:path";

export async function connectDatabase(configOrPath) {
  const normalized = normalizeDatabaseConfig(configOrPath);
  if (normalized.client === "postgres") {
    return connectPostgresDatabase(normalized);
  }

  return connectSqliteDatabase(normalized.path);
}

export function wrapDatabase(sqlite) {
  return sqlite instanceof BaseDatabase
    ? sqlite
    : new SqliteDatabase(sqlite);
}

export function syncGet(database, sql, params = {}) {
  if (hasConcreteMethod(database, "get")) {
    return database.get(sql, params) ?? null;
  }
  if (hasConcreteMethod(database, "prepare")) {
    return database.prepare(sql).get(params) ?? null;
  }
  throw new Error("Synchronous get() is not available for this database adapter.");
}

export function syncAll(database, sql, params = {}) {
  if (hasConcreteMethod(database, "all")) {
    return database.all(sql, params);
  }
  if (hasConcreteMethod(database, "prepare")) {
    return database.prepare(sql).all(params);
  }
  throw new Error("Synchronous all() is not available for this database adapter.");
}

export function syncRun(database, sql, params = {}) {
  if (hasConcreteMethod(database, "run")) {
    return database.run(sql, params);
  }
  if (hasConcreteMethod(database, "prepare")) {
    return database.prepare(sql).run(params);
  }
  throw new Error("Synchronous run() is not available for this database adapter.");
}

export function syncExec(database, sql) {
  if (hasConcreteMethod(database, "exec")) {
    return database.exec(sql);
  }
  if (hasConcreteMethod(database, "prepare")) {
    return database.prepare(sql).run();
  }
  throw new Error("Synchronous exec() is not available for this database adapter.");
}

export class BaseDatabase {
  constructor({ client, supportsPrepare }) {
    this.client = client;
    this.supportsPrepare = supportsPrepare;
  }

  exec() {
    throw new Error(`exec() is not implemented for the ${this.client} database adapter.`);
  }

  get() {
    throw new Error(`Synchronous get() is not supported for the ${this.client} database adapter. Use getAsync() instead.`);
  }

  all() {
    throw new Error(`Synchronous all() is not supported for the ${this.client} database adapter. Use allAsync() instead.`);
  }

  run() {
    throw new Error(`Synchronous run() is not supported for the ${this.client} database adapter. Use runAsync() instead.`);
  }

  prepare() {
    throw new Error(`prepare() is not supported for the ${this.client} database adapter.`);
  }

  async execAsync() {
    throw new Error(`execAsync() is not implemented for the ${this.client} database adapter.`);
  }

  async getAsync() {
    throw new Error(`getAsync() is not implemented for the ${this.client} database adapter.`);
  }

  async allAsync() {
    throw new Error(`allAsync() is not implemented for the ${this.client} database adapter.`);
  }

  async runAsync() {
    throw new Error(`runAsync() is not implemented for the ${this.client} database adapter.`);
  }

  async withTransaction() {
    throw new Error(`withTransaction() is not implemented for the ${this.client} database adapter.`);
  }

  async close() {}
}

export class SqliteDatabase extends BaseDatabase {
  constructor(sqlite) {
    super({ client: "sqlite", supportsPrepare: true });
    this.sqlite = sqlite;
  }

  exec(sql) {
    return this.sqlite.exec(sql);
  }

  get(sql, params = {}) {
    return this.sqlite.prepare(sql).get(params) ?? null;
  }

  all(sql, params = {}) {
    return this.sqlite.prepare(sql).all(params);
  }

  run(sql, params = {}) {
    return this.sqlite.prepare(sql).run(params);
  }

  prepare(sql) {
    return this.sqlite.prepare(sql);
  }

  execAsync(sql) {
    this.sqlite.exec(sql);
    return Promise.resolve();
  }

  getAsync(sql, params = {}) {
    return Promise.resolve(this.sqlite.prepare(sql).get(params) ?? null);
  }

  allAsync(sql, params = {}) {
    return Promise.resolve(this.sqlite.prepare(sql).all(params));
  }

  runAsync(sql, params = {}) {
    return Promise.resolve(this.sqlite.prepare(sql).run(params));
  }

  async withTransaction(work) {
    this.sqlite.exec("BEGIN");
    try {
      const result = await work(this);
      this.sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

export class PostgresDatabase extends BaseDatabase {
  constructor(pool) {
    super({ client: "postgres", supportsPrepare: false });
    this.pool = pool;
  }

  async execAsync(sql) {
    await this.pool.query(sql);
  }

  async getAsync(sql, params = {}) {
    const result = await executePostgresQuery(this.pool, sql, params);
    return result.rows[0] ?? null;
  }

  async allAsync(sql, params = {}) {
    const result = await executePostgresQuery(this.pool, sql, params);
    return result.rows;
  }

  async runAsync(sql, params = {}) {
    const result = await executePostgresQuery(this.pool, sql, params);
    return {
      changes: Number(result.rowCount ?? 0),
      lastInsertRowid: result.rows?.[0]?.id ?? null
    };
  }

  async withTransaction(work) {
    const client = await this.pool.connect();
    const transaction = new PostgresTransactionDatabase(client);
    try {
      await client.query("BEGIN");
      const result = await work(transaction);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

class PostgresTransactionDatabase extends BaseDatabase {
  constructor(pgClient) {
    super({ client: "postgres", supportsPrepare: false });
    this.pgClient = pgClient;
  }

  async execAsync(sql) {
    await this.pgClient.query(sql);
  }

  async getAsync(sql, params = {}) {
    const result = await executePostgresQuery(this.pgClient, sql, params);
    return result.rows[0] ?? null;
  }

  async allAsync(sql, params = {}) {
    const result = await executePostgresQuery(this.pgClient, sql, params);
    return result.rows;
  }

  async runAsync(sql, params = {}) {
    const result = await executePostgresQuery(this.pgClient, sql, params);
    return {
      changes: Number(result.rowCount ?? 0),
      lastInsertRowid: result.rows?.[0]?.id ?? null
    };
  }

  async withTransaction(work) {
    return work(this);
  }
}

async function connectSqliteDatabase(databasePath) {
  const { DatabaseSync } = await import("node:sqlite");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  return wrapDatabase(sqlite);
}

async function connectPostgresDatabase(config) {
  const connectionString = String(config.url ?? "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required when DATABASE_CLIENT=postgres.");
  }

  let pgModule;
  try {
    pgModule = await import("pg");
  } catch (error) {
    throw new Error("Postgres support requires the `pg` package to be installed.");
  }

  const { Pool } = pgModule;
  const ssl = config.sslEnabled
    ? { rejectUnauthorized: config.sslRejectUnauthorized !== false }
    : undefined;
  const pool = new Pool({
    connectionString,
    max: Number(config.poolMax ?? 10) || 10,
    idleTimeoutMillis: Number(config.idleTimeoutMs ?? 30000) || 30000,
    ssl
  });
  return new PostgresDatabase(pool);
}

function normalizeDatabaseConfig(configOrPath) {
  if (typeof configOrPath === "string") {
    return {
      client: "sqlite",
      path: configOrPath,
      url: ""
    };
  }

  const client = String(configOrPath?.client ?? "sqlite").trim().toLowerCase();
  return {
    client: client === "postgres" ? "postgres" : "sqlite",
    path: configOrPath?.path ?? "",
    url: configOrPath?.url ?? "",
    poolMax: configOrPath?.poolMax,
    idleTimeoutMs: configOrPath?.idleTimeoutMs,
    sslEnabled: configOrPath?.sslEnabled,
    sslRejectUnauthorized: configOrPath?.sslRejectUnauthorized
  };
}

function executePostgresQuery(executor, sql, params) {
  const compiled = compileNamedParameters(sql, params);
  return executor.query(compiled.text, compiled.values).catch((error) => {
    throw buildPostgresQueryError(error, compiled);
  });
}

function compileNamedParameters(sql, params = {}) {
  if (Array.isArray(params)) {
    return {
      text: sql,
      values: params
    };
  }

  const values = [];
  const placeholders = new Map();
  const text = String(sql).replace(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      throw new Error(`Missing database parameter :${key}.`);
    }

    if (!placeholders.has(key)) {
      values.push(params[key]);
      placeholders.set(key, `$${values.length}`);
    }

    return placeholders.get(key);
  });

  return {
    text,
    values
  };
}

function buildPostgresQueryError(error, compiled) {
  const wrapped = new Error([
    error?.message ?? "Postgres query failed.",
    `SQL: ${collapseWhitespace(compiled?.text ?? "")}`,
    `Values: ${safeJson(compiled?.values ?? [])}`
  ].join(" | "));
  wrapped.name = error?.name ?? "PostgresQueryError";
  wrapped.code = error?.code;
  wrapped.query = collapseWhitespace(compiled?.text ?? "");
  wrapped.values = compiled?.values ?? [];
  wrapped.cause = error;
  if (error?.stack) {
    wrapped.stack = `${wrapped.name}: ${wrapped.message}\nCaused by: ${error.stack}`;
  }
  return wrapped;
}

function hasConcreteMethod(target, methodName) {
  const method = target?.[methodName];
  if (typeof method !== "function") {
    return false;
  }
  return method !== BaseDatabase.prototype[methodName];
}

function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}
