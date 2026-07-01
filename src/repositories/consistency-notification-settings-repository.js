export class ConsistencyNotificationSettingsRepository {
  constructor(database) { this.database = database; }

  async get() {
    const row = await this.database.getAsync("SELECT * FROM consistency_notification_settings WHERE id = 1");
    return mapRow(row);
  }

  async update({ enabled, recipients, userId = null, userName = null }) {
    const now = new Date().toISOString();
    await this.database.runAsync(`
      UPDATE consistency_notification_settings SET
        enabled = :enabled, recipients = :recipients,
        updated_by_user_id = :updated_by_user_id, updated_by_name = :updated_by_name,
        updated_at = :updated_at
      WHERE id = 1
    `, {
      enabled: enabled ? 1 : 0,
      recipients: JSON.stringify(recipients ?? []),
      updated_by_user_id: userId,
      updated_by_name: userName,
      updated_at: now
    });
    return this.get();
  }

  async recordRun({ localDate, result, error = null }) {
    await this.database.runAsync(`
      UPDATE consistency_notification_settings SET
        last_run_local_date = :last_run_local_date,
        last_result = :last_result,
        last_error = :last_error,
        updated_at = :updated_at
      WHERE id = 1
    `, {
      last_run_local_date: localDate,
      last_result: result,
      last_error: error,
      updated_at: new Date().toISOString()
    });
  }
}

function mapRow(row) {
  if (!row) return { enabled: false, recipients: [], lastRunLocalDate: null, lastResult: null, lastError: null };
  let recipients = [];
  try { recipients = JSON.parse(row.recipients || "[]"); } catch { recipients = []; }
  return {
    enabled: Number(row.enabled) === 1,
    recipients: Array.isArray(recipients) ? recipients : [],
    lastRunLocalDate: row.last_run_local_date ?? null,
    lastResult: row.last_result ?? null,
    lastError: row.last_error ?? null,
    updatedByName: row.updated_by_name ?? null,
    updatedAt: row.updated_at ?? null
  };
}
