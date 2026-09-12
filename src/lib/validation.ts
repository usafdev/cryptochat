import { Buffer } from "node:buffer";
import { createPublicKey } from "node:crypto";

const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const PUBLIC_KEY_BYTES = 294;
const RSA_WRAPPED_KEY_BYTES = 256;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const MAX_MESSAGE_BYTES = 100_000;
const MAX_CIPHERTEXT_BYTES = 75_000;

function decodeBase64Url(value: string): Buffer | null {
  if (
    !value ||
    !BASE64_URL_PATTERN.test(value) ||
    value.length % 4 === 1
  ) {
    return null;
  }

  const decoded = Buffer.from(
    value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="),
    "base64"
  );
  const canonical = decoded
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return canonical === value ? decoded : null;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === keys.length && actualKeys.every((key, index) => key === keys.sort()[index]);
}

function isBase64Url(value: unknown, minBytes: number, maxBytes: number, exactBytes?: number): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const decoded = decodeBase64Url(value);
  if (!decoded) {
    return false;
  }

  return exactBytes !== undefined
    ? decoded.length === exactBytes
    : decoded.length >= minBytes && decoded.length <= maxBytes;
}

export function isValidPublicKey(value: unknown): value is string {
  if (!isBase64Url(value, PUBLIC_KEY_BYTES, PUBLIC_KEY_BYTES, PUBLIC_KEY_BYTES)) {
    return false;
  }

  try {
    const key = createPublicKey({
      key: decodeBase64Url(value as string) as Buffer,
      format: "der",
      type: "spki",
    });
    return (
      key.asymmetricKeyType === "rsa" &&
      key.asymmetricKeyDetails?.modulusLength === 2048
    );
  } catch {
    return false;
  }
}

export function isValidEncryptedPrivateKey(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 20_000) {
    return false;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return false;
  }

  const payload = parsed as Record<string, unknown>;
  return (
    hasExactKeys(payload, ["salt", "iv", "encrypted"]) &&
    isBase64Url(payload.salt, 16, 16, 16) &&
    isBase64Url(payload.iv, AES_GCM_IV_BYTES, AES_GCM_IV_BYTES, AES_GCM_IV_BYTES) &&
    isBase64Url(payload.encrypted, AES_GCM_TAG_BYTES, 16_000)
  );
}

export function isValidEncryptedMessagePayload(
  value: unknown,
  expectedAssociatedData: string
): value is {
  version: "v2";
  ciphertext: string;
  iv: string;
  encryptedKey?: string;
  senderEncryptedKey?: string;
  associatedData: string;
} {
  if (typeof value !== "string" || value.length > MAX_MESSAGE_BYTES) {
    return false;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return false;
  }

  const payload = parsed as Record<string, unknown>;
  const allowedKeys = [
    "associatedData",
    "ciphertext",
    "encryptedKey",
    "iv",
    "senderEncryptedKey",
    "version",
  ];
  if (Object.keys(payload).some((key) => !allowedKeys.includes(key))) {
    return false;
  }

  const hasRecipientKey = isBase64Url(
    payload.encryptedKey,
    RSA_WRAPPED_KEY_BYTES,
    RSA_WRAPPED_KEY_BYTES,
    RSA_WRAPPED_KEY_BYTES
  );
  const hasSenderKey =
    payload.senderEncryptedKey === undefined ||
    isBase64Url(
      payload.senderEncryptedKey,
      RSA_WRAPPED_KEY_BYTES,
      RSA_WRAPPED_KEY_BYTES,
      RSA_WRAPPED_KEY_BYTES
    );

  return (
    payload.version === "v2" &&
    typeof payload.associatedData === "string" &&
    payload.associatedData === expectedAssociatedData &&
    isBase64Url(payload.iv, AES_GCM_IV_BYTES, AES_GCM_IV_BYTES, AES_GCM_IV_BYTES) &&
    isBase64Url(payload.ciphertext, AES_GCM_TAG_BYTES, MAX_CIPHERTEXT_BYTES) &&
    (hasRecipientKey || (payload.encryptedKey === undefined && hasSenderKey)) &&
    hasSenderKey
  );
}

export const encryptedMessageLimits = {
  maxSerializedBytes: MAX_MESSAGE_BYTES,
  maxCiphertextBytes: MAX_CIPHERTEXT_BYTES,
};
