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

  acknowledge({ field, value, displayValue = null, userId = null, userName = null, createdAt = new Date().toISOString() }) {
    return syncRun(this.database, this.insertSql(), this.insertParams({ field, value, displayValue, userId, userName, createdAt }));
  }

  async acknowledgeAsync({ field, value, displayValue = null, userId = null, userName = null, createdAt = new Date().toISOString() }) {
    if (typeof this.database.runAsync !== "function") {
      return this.acknowledge({ field, value, displayValue, userId, userName, createdAt });
    }
    return await this.database.runAsync(this.insertSql(), this.insertParams({ field, value, displayValue, userId, userName, createdAt }));
  }

  insertSql() {
    return `
      INSERT INTO utm_value_acknowledgements (
        field,
        value,
        display_value,
        acknowledged_by_user_id,
        acknowledged_by_name,
        created_at
      ) VALUES (
        :field,
        :value,
        :display_value,
        :acknowledged_by_user_id,
        :acknowledged_by_name,
        :created_at
      )
      ON CONFLICT (field, value) DO UPDATE SET
        display_value = COALESCE(NULLIF(EXCLUDED.display_value, ''), utm_value_acknowledgements.display_value)
    `;
  }

  insertParams({ field, value, displayValue, userId, userName, createdAt }) {
    return {
      field: String(field ?? "").trim(),
      value: String(value ?? "").trim(),
      display_value: String(displayValue ?? "").trim() || null,
      acknowledged_by_user_id: userId ?? null,
      acknowledged_by_name: userName ?? null,
      created_at: createdAt
    };
  }
}
