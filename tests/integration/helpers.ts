import { loadEnvConfig } from "@next/env";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import {
  encryptPrivateKeyForStorage,
  generateUserKeyPair,
  type EncryptedPrivateKey,
} from "../../src/lib/crypto";

loadEnvConfig(process.cwd());

export const integrationBaseUrl = "http://127.0.0.1:3101";

let serverProcess: ChildProcess | null = null;

export type TestUser = {
  username: string;
  email: string;
  password: string;
};

export type TestAccount = TestUser & {
  id: string;
  publicKey: string;
  privateKey: string;
  encryptedPrivateKey: EncryptedPrivateKey;
};

export async function startIntegrationServer() {
  if (serverProcess) return;

  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: "3101",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const collectOutput = (chunk: Buffer) => {
    output += chunk.toString();
  };
  serverProcess.stdout?.on("data", collectOutput);
  serverProcess.stderr?.on("data", collectOutput);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Integration server exited early:\n${output}`);
    }

    try {
      const response = await fetch(`${integrationBaseUrl}/`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.status < 500) return;
    } catch {
      // The server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for integration server:\n${output}`);
}

export async function stopIntegrationServer() {
  if (!serverProcess) return;

  serverProcess.kill();
  await Promise.race([
    once(serverProcess, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  serverProcess = null;
}

export function createTestUser(label: string): TestUser {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const normalizedLabel = label.replace(/[^a-z0-9]/gi, "").slice(0, 6);
  return {
    username: `test_${normalizedLabel}_${suffix}`,
    email: `${label}.${suffix}@example.test`,
    password: "correct horse battery staple",
  };
}

export async function signupTestAccount(label: string): Promise<TestAccount> {
  const user = createTestUser(label);
  const keyPair = await generateUserKeyPair();
  const encryptedPrivateKey = await encryptPrivateKeyForStorage(
    keyPair.privateKey,
    user.password
  );
  const response = await jsonRequest("/api/signup", {
    method: "POST",
    headers: { "x-real-ip": `integration-${user.username}` },
    body: JSON.stringify({
      ...user,
      publicKey: keyPair.publicKey,
      encryptedPrivateKey: JSON.stringify(encryptedPrivateKey),
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Unable to create integration user: ${response.status} ${await response.text()}`
    );
  }

  const body = (await response.json()) as { id: string };
  return {
    ...user,
    id: body.id,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    encryptedPrivateKey,
  };
}

export function cookieHeader(response: Response): string {
  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("Expected response to set a session cookie");
  }
  return cookie.split(";", 1)[0];
}

export async function jsonRequest(
  path: string,
  init: RequestInit & { cookie?: string } = {}
) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);

  return fetch(`${integrationBaseUrl}${path}`, {
    ...init,
    headers,
  });
}

export async function getPrisma() {
  return (await import("@/lib/prisma")).prisma;
}

export async function cleanupTestUsers(usernames: string[]) {
  const prisma = await getPrisma();
  const users = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.message.deleteMany({
      where: { senderId: { in: userIds } },
    });
    await tx.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: { in: userIds } },
          { receiverId: { in: userIds } },
        ],
      },
    });
    await tx.session.deleteMany({
      where: { userId: { in: userIds } },
    });
    await tx.conversation.deleteMany({
      where: { participants: { some: { id: { in: userIds } } } },
    });
    await tx.user.deleteMany({
      where: { id: { in: userIds } },
    });
  });
}
