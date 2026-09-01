export type EncryptedMessagePayload = {
  version: "v1";
  ciphertext: string;
  iv: string;
  encryptedKey: string;
};

export type EncryptedPrivateKey = {
  salt: string;
  iv: string;
  encrypted: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importPublicKey(spkiBase64: string) {
  const keyBytes = fromBase64Url(spkiBase64);
  return crypto.subtle.importKey(
    "spki",
    keyBytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

async function importPrivateKey(pkcs8Base64: string) {
  const keyBytes = fromBase64Url(pkcs8Base64);
  return crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
}

async function derivePasswordKey(password: string, salt: Uint8Array) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 200000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function generateUserKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const [publicKeyBytes, privateKeyBytes] = await Promise.all([
    crypto.subtle.exportKey("spki", keyPair.publicKey),
    crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
  ]);

  return {
    publicKey: toBase64Url(publicKeyBytes),
    privateKey: toBase64Url(privateKeyBytes),
  };
}

export async function encryptPrivateKeyForStorage(
  privateKey: string,
  password: string
): Promise<EncryptedPrivateKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivePasswordKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(privateKey)
  );

  return {
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
    encrypted: toBase64Url(encrypted),
  };
}

export async function decryptPrivateKeyFromStorage(
  payload: EncryptedPrivateKey,
  password: string
): Promise<string> {
  const key = await derivePasswordKey(password, fromBase64Url(payload.salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(payload.iv) },
    key,
    fromBase64Url(payload.encrypted)
  );

  return textDecoder.decode(decrypted);
}

export async function encryptMessagePayload(
  plaintext: string,
  recipientPublicKey: string
): Promise<EncryptedMessagePayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const symmetricKey = crypto.getRandomValues(new Uint8Array(32));

  const aesKey = await crypto.subtle.importKey(
    "raw",
    symmetricKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    textEncoder.encode(plaintext)
  );

  const publicKey = await importPublicKey(recipientPublicKey);
  const encryptedKey = await crypto.subtle.wrapKey(
    "raw",
    aesKey,
    publicKey,
    { name: "RSA-OAEP" }
  );

  return {
    version: "v1",
    ciphertext: toBase64Url(ciphertext),
    iv: toBase64Url(iv),
    encryptedKey: toBase64Url(encryptedKey),
  };
}

export async function decryptMessagePayload(
  serializedPayload: string,
  privateKeyBase64: string
): Promise<string | null> {
  if (!serializedPayload || !privateKeyBase64) {
    return null;
  }

  try {
    const parsed = JSON.parse(serializedPayload) as Partial<EncryptedMessagePayload>;

    if (!parsed?.ciphertext || !parsed?.iv || !parsed?.encryptedKey) {
      return null;
    }

    const privateKey = await importPrivateKey(privateKeyBase64);
    const aesKey = await crypto.subtle.unwrapKey(
      "raw",
      fromBase64Url(parsed.encryptedKey),
      privateKey,
      { name: "RSA-OAEP" },
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(parsed.iv) },
      aesKey,
      fromBase64Url(parsed.ciphertext)
    );

    return textDecoder.decode(decrypted);
  } catch {
    return null;
  }
}
