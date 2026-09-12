import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decryptMessagePayload,
  decryptPrivateKeyFromStorage,
  encryptMessagePayload,
  encryptPrivateKeyForStorage,
  generateUserKeyPair,
} from "../src/lib/crypto";
import {
  isValidEncryptedMessagePayload,
  isValidEncryptedPrivateKey,
  isValidPublicKey,
} from "../src/lib/validation";
import { enforceRateLimit, resetRateLimitsForTests } from "../src/lib/rate-limit";

test("encrypts and decrypts a private key with the account password", async () => {
  const keyPair = await generateUserKeyPair();
  const stored = await encryptPrivateKeyForStorage(
    keyPair.privateKey,
    "correct horse battery staple"
  );

  assert.notEqual(stored.encrypted, keyPair.privateKey);
  assert.equal(
    await decryptPrivateKeyFromStorage(stored, "correct horse battery staple"),
    keyPair.privateKey
  );
  await assert.rejects(() =>
    decryptPrivateKeyFromStorage(stored, "wrong password")
  );
});

test("round-trips an encrypted message for the recipient", async () => {
  const keyPair = await generateUserKeyPair();
  const payload = await encryptMessagePayload(
    "private message",
    keyPair.publicKey,
    undefined,
    "conversation:conversation-1:sender:user-1"
  );

  assert.equal(
    await decryptMessagePayload(
      JSON.stringify(payload),
      keyPair.privateKey,
      "conversation:conversation-1:sender:user-1"
    ),
    "private message"
  );
  assert.equal(
    await decryptMessagePayload(
      JSON.stringify(payload),
      keyPair.privateKey,
      "conversation:conversation-2:sender:user-1"
    ),
    null
  );
  assert.equal(
    await decryptMessagePayload(JSON.stringify(payload), "invalid-key"),
    null
  );
});

test("round-trips an encrypted message for both participants", async () => {
  const recipient = await generateUserKeyPair();
  const sender = await generateUserKeyPair();
  const payload = await encryptMessagePayload(
    "message for both participants",
    recipient.publicKey,
    sender.publicKey,
    "conversation:conversation-1:sender:user-1"
  );

  assert.equal(
    await decryptMessagePayload(
      JSON.stringify(payload),
      recipient.privateKey,
      "conversation:conversation-1:sender:user-1"
    ),
    "message for both participants"
  );
  assert.equal(
    await decryptMessagePayload(
      JSON.stringify(payload),
      sender.privateKey,
      "conversation:conversation-1:sender:user-1"
    ),
    "message for both participants"
  );
});

test("rejects malformed encrypted message payloads", async () => {
  const keyPair = await generateUserKeyPair();

  assert.equal(
    await decryptMessagePayload(
      JSON.stringify({ version: "v1", ciphertext: "invalid" }),
      keyPair.privateKey
    ),
    null
  );
});

test("validates stored keys and encrypted message shape", async () => {
  const recipient = await generateUserKeyPair();
  const storedPrivateKey = await encryptPrivateKeyForStorage(
    recipient.privateKey,
    "correct horse battery staple"
  );
  const serializedPrivateKey = JSON.stringify(storedPrivateKey);
  const payload = await encryptMessagePayload(
    "validated message",
    recipient.publicKey,
    undefined,
    "conversation:conversation-1:sender:user-1"
  );

  assert.equal(isValidPublicKey(recipient.publicKey), true);
  assert.equal(isValidEncryptedPrivateKey(serializedPrivateKey), true);
  assert.equal(
    isValidEncryptedMessagePayload(
      JSON.stringify(payload),
      "conversation:conversation-1:sender:user-1"
    ),
    true
  );
  assert.equal(isValidPublicKey("not-a-public-key"), false);
  assert.equal(
    isValidEncryptedPrivateKey(JSON.stringify({ ...storedPrivateKey, extra: "field" })),
    false
  );
  assert.equal(
    isValidEncryptedMessagePayload(
      JSON.stringify({ ...payload, unexpected: "field" }),
      "conversation:conversation-1:sender:user-1"
    ),
    false
  );
});

test("rate limits requests in a single process", () => {
  resetRateLimitsForTests();
  const request = new Request("http://localhost/api/login", {
    headers: { "x-real-ip": "198.51.100.10" },
  });

  assert.equal(
    enforceRateLimit(request, { name: "test", limit: 1, windowMs: 60_000 }),
    null
  );
  const limited = enforceRateLimit(request, {
    name: "test",
    limit: 1,
    windowMs: 60_000,
  });
  assert.equal(limited?.status, 429);
  assert.equal(limited?.headers.get("retry-after"), "60");
});
