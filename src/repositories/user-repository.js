export class UserRepository {
  constructor(database) {
    this.database = database;
  }

  async create({
    username,
    displayName,
    role = "user",
    passwordHash,
    passwordSalt,
    isActive = 1,
    createdAt,
    updatedAt
  }) {
    const now = new Date().toISOString();
    const result = await this.database.runAsync(`
      INSERT INTO users (
        username,
        display_name,
        role,
        password_hash,
        password_salt,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        :username,
        :display_name,
        :role,
        :password_hash,
        :password_salt,
        :is_active,
        :created_at,
        :updated_at
      )${this.database.client === "postgres" ? "\n      RETURNING id" : ""}
    `, {
      username,
      display_name: displayName,
      role,
      password_hash: passwordHash,
      password_salt: passwordSalt,
      is_active: isActive ? 1 : 0,
      created_at: createdAt ?? now,
      updated_at: updatedAt ?? now
    });

    return Number(result.lastInsertRowid);
  }

  async findByUsername(username) {
    return await this.database.getAsync(
      "SELECT * FROM users WHERE username = :username LIMIT 1",
      { username: String(username ?? "").trim().toLowerCase() }
    ) ?? null;
  }

  async findById(id) {
    return await this.database.getAsync(
      "SELECT * FROM users WHERE id = :id LIMIT 1",
      { id: Number(id) }
    ) ?? null;
  }

  async list({ role = null } = {}) {
    if (role) {
      return await this.database.allAsync(
        "SELECT * FROM users WHERE role = :role ORDER BY LOWER(display_name) ASC, id ASC",
        { role }
      );
    }
    return await this.database.allAsync(
      "SELECT * FROM users ORDER BY LOWER(display_name) ASC, id ASC"
    );
  }

  async countActiveByRole(role) {
    const row = await this.database.getAsync(
      "SELECT COUNT(*) AS count FROM users WHERE role = :role AND is_active = 1",
      { role }
    );
    return Number(row?.count ?? 0);
  }

  async countAll() {
    const row = await this.database.getAsync("SELECT COUNT(*) AS count FROM users");
    return Number(row?.count ?? 0);
  }

  async update(id, fields = {}) {
    const payload = {
      ...fields,
      updated_at: fields.updated_at ?? new Date().toISOString()
    };
    const assignments = Object.keys(payload).map((field) => `${field} = :${field}`).join(", ");
    await this.database.runAsync(
      `UPDATE users SET ${assignments} WHERE id = :id`,
      { ...payload, id: Number(id) }
    );
  }

  async delete(id) {
    const result = await this.database.runAsync(
      "DELETE FROM users WHERE id = :id",
      { id: Number(id) }
    );
    return Number(result.changes ?? 0);
  }
}
