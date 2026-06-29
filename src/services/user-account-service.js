import { hashPassword, verifyPassword } from "../support/password.js";

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,38}[a-z0-9])$/u;
const MIN_PASSWORD_LENGTH = 8;
const VALID_ROLES = ["admin", "user"];

export class UserAccountService {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async list(role = null) {
    const rows = await this.userRepository.list(role ? { role } : {});
    return rows.map(toPublicUser);
  }

  async get(id) {
    const row = await this.userRepository.findById(id);
    return row ? toPublicUser(row) : null;
  }

  async createUser({ username, displayName, password, role = "user" }) {
    const normalizedUsername = String(username ?? "").trim().toLowerCase();
    const normalizedDisplay = String(displayName ?? "").trim() || normalizedUsername;
    const normalizedRole = VALID_ROLES.includes(String(role)) ? String(role) : "user";

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      return failure("invalid_username", "Username must be 3-40 characters using letters, numbers, dots, dashes, or underscores.");
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return failure("invalid_password", passwordError);
    }

    const existing = await this.userRepository.findByUsername(normalizedUsername);
    if (existing) {
      return failure("username_taken", "That username is already in use.");
    }

    const { salt, hash } = hashPassword(password);
    const id = await this.userRepository.create({
      username: normalizedUsername,
      displayName: normalizedDisplay,
      role: normalizedRole,
      passwordHash: hash,
      passwordSalt: salt,
      isActive: 1
    });

    return { ok: true, user: toPublicUser(await this.userRepository.findById(id)) };
  }

  async setActive(id, isActive) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      return failure("not_found", "That account no longer exists.", 404);
    }

    if (!isActive && user.role === "admin" && Number(user.is_active) === 1) {
      const activeAdmins = await this.userRepository.countActiveByRole("admin");
      if (activeAdmins <= 1) {
        return failure("last_admin", "You cannot deactivate the last active administrator.", 409);
      }
    }

    await this.userRepository.update(id, { is_active: isActive ? 1 : 0 });
    return { ok: true, user: toPublicUser(await this.userRepository.findById(id)) };
  }

  async resetPassword(id, password) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      return failure("not_found", "That account no longer exists.", 404);
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return failure("invalid_password", passwordError);
    }
    const { salt, hash } = hashPassword(password);
    await this.userRepository.update(id, { password_hash: hash, password_salt: salt });
    return { ok: true };
  }

  async deleteUser(id) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      return failure("not_found", "That account no longer exists.", 404);
    }
    if (user.role === "admin" && Number(user.is_active) === 1) {
      const activeAdmins = await this.userRepository.countActiveByRole("admin");
      if (activeAdmins <= 1) {
        return failure("last_admin", "You cannot delete the last active administrator.", 409);
      }
    }
    await this.userRepository.delete(id);
    return { ok: true };
  }

  async changeOwnPassword(userId, currentPassword, newPassword) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return failure("not_found", "Your account could not be found.", 404);
    }
    if (!verifyPassword(currentPassword, user.password_salt, user.password_hash)) {
      return failure("invalid_current_password", "Your current password is incorrect.");
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return failure("invalid_password", passwordError);
    }
    const { salt, hash } = hashPassword(newPassword);
    await this.userRepository.update(userId, { password_hash: hash, password_salt: salt });
    return { ok: true };
  }
}

function validatePassword(password) {
  const value = String(password ?? "");
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

function toPublicUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isActive: Number(row.is_active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function failure(code, message, statusCode = 422) {
  return { ok: false, code, message, statusCode };
}
