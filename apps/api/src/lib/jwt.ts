import { createHmac } from "node:crypto";

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
