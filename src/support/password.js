import crypto from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(plain ?? ""), salt, KEY_LENGTH).toString("hex");
  return { salt, hash };
}

export function verifyPassword(plain, salt, hash) {
  if (!salt || !hash) {
    return false;
  }

  let stored;
  try {
    stored = Buffer.from(String(hash), "hex");
  } catch {
    return false;
  }

  const computed = crypto.scryptSync(String(plain ?? ""), String(salt), KEY_LENGTH);
  if (stored.length !== computed.length) {
    return false;
  }

  return crypto.timingSafeEqual(stored, computed);
}
