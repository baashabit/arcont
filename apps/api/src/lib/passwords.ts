import { createHash, randomBytes } from "node:crypto";

export function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password: string, passwordHash: string) {
  return hashPassword(password) === passwordHash;
}

export function generateTemporaryPassword() {
  return randomBytes(6).toString("base64url");
}
