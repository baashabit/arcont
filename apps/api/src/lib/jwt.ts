import { createHmac } from "node:crypto";
import { authError } from "./domain-error.js";

function toBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function signJwt(payload: Record<string, unknown>, secret: string, expiresInSeconds: number) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const issuedAt = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(fullPayload));
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string, secret: string) {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    throw authError("AUTH_INVALID_TOKEN", "Invalid access token");
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  if (signature !== expectedSignature) {
    throw authError("AUTH_INVALID_TOKEN", "Invalid access token");
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    throw authError("AUTH_INVALID_TOKEN", "Invalid access token");
  }

  const exp = typeof payload.exp === "number" ? payload.exp : Number.NaN;
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    throw authError("AUTH_TOKEN_EXPIRED", "Access token expired");
  }

  return payload;
}
