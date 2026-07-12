import { randomUUID } from "node:crypto";

export function createPrefixedId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
