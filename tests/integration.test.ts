import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { io, type Socket } from "socket.io-client";
import {
  cleanupTestUsers,
  cookieHeader,
  createTestUser,
  getPrisma,
  jsonRequest,
  signupTestAccount,
  startIntegrationServer,
  stopIntegrationServer,
  type TestAccount,
  type TestUser,
} from "./integration/helpers";
import {
  encryptMessagePayload,
  encryptPrivateKeyForStorage,
  generateUserKeyPair,
} from "../src/lib/crypto";

const users: TestUser[] = [];
const accounts: TestAccount[] = [];
let conversationId = "";

function connectSocket(cookie?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io("http://127.0.0.1:3101", {
      transports: ["websocket"],
      extraHeaders: cookie ? { cookie } : undefined,
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error) => {
      socket.close();
      reject(error);
    });
  });
}

function sessionIdFromCookie(cookie: string): string {
  const token = cookie.slice(cookie.indexOf("=") + 1);
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Invalid session cookie");
  return (JSON.parse(Buffer.from(payload, "base64url").toString()) as {
    sessionId: string;
  }).sessionId;
}

before(async () => {
  await startIntegrationServer();
});

after(async () => {
  await cleanupTestUsers([
    ...users.map((user) => user.username),
    ...accounts.map((account) => account.username),
  ]);
  await stopIntegrationServer();
  const prisma = await getPrisma();
  await prisma.$disconnect();
});

test("signup creates an authenticated session and persists it", async () => {
  const user = createTestUser("signup");
  users.push(user);
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

  assert.equal(response.status, 200);
  assert.equal((await response.json()).username, user.username);
  const cookie = cookieHeader(response);
  assert.match(cookie, /^cryptochat_session=.+/);

  const prisma = await getPrisma();
  const storedUser = await prisma.user.findUnique({
    where: { username: user.username },
    include: { sessions: true },
  });
  assert.ok(storedUser);
  assert.equal(storedUser.sessions.length, 1);
  assert.equal(storedUser.sessions[0]?.revokedAt, null);
});

test("login rejects invalid credentials and creates a session for valid credentials", async () => {
  const user = createTestUser("login");
  users.push(user);
  const keyPair = await generateUserKeyPair();
  const encryptedPrivateKey = await encryptPrivateKeyForStorage(
    keyPair.privateKey,
    user.password
  );

  const signupResponse = await jsonRequest("/api/signup", {
    method: "POST",
    headers: { "x-real-ip": `integration-${user.username}` },
    body: JSON.stringify({
      ...user,
      publicKey: keyPair.publicKey,
      encryptedPrivateKey: JSON.stringify(encryptedPrivateKey),
    }),
  });
  assert.equal(signupResponse.status, 200);

  const invalidResponse = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: user.username,
      password: "wrong password",
    }),
  });
  assert.equal(invalidResponse.status, 401);

  const validResponse = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: user.username,
      password: user.password,
    }),
  });
  assert.equal(validResponse.status, 200);
  assert.match(cookieHeader(validResponse), /^cryptochat_session=.+/);
});

test("only conversation participants can read messages", async () => {
  const sender = await signupTestAccount("authorization_sender");
  const recipient = await signupTestAccount("authorization_recipient");
  const outsider = await signupTestAccount("authorization_outsider");
  accounts.push(sender, recipient, outsider);

  const prisma = await getPrisma();
  await prisma.friendRequest.create({
    data: {
      senderId: sender.id,
      receiverId: recipient.id,
      status: "accepted",
    },
  });
  const conversation = await prisma.conversation.create({
    data: {
      directKey: [sender.id, recipient.id].sort().join(":"),
      participants: {
        connect: [{ id: sender.id }, { id: recipient.id }],
      },
    },
  });
  conversationId = conversation.id;

  const senderLogin = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: sender.username,
      password: sender.password,
    }),
  });
  const recipientLogin = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: recipient.username,
      password: recipient.password,
    }),
  });
  const outsiderLogin = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: outsider.username,
      password: outsider.password,
    }),
  });
  const senderCookie = cookieHeader(senderLogin);
  const recipientCookie = cookieHeader(recipientLogin);
  const outsiderCookie = cookieHeader(outsiderLogin);

  const senderRead = await jsonRequest(
    `/api/messages?conversationId=${conversationId}&userId=${sender.id}`,
    { cookie: senderCookie }
  );
  assert.equal(senderRead.status, 200);

  const recipientRead = await jsonRequest(
    `/api/messages?conversationId=${conversationId}&userId=${recipient.id}`,
    { cookie: recipientCookie }
  );
  assert.equal(recipientRead.status, 200);

  const outsiderRead = await jsonRequest(
    `/api/messages?conversationId=${conversationId}&userId=${outsider.id}`,
    { cookie: outsiderCookie }
  );
  assert.equal(outsiderRead.status, 403);

  const forgedUserRead = await jsonRequest(
    `/api/messages?conversationId=${conversationId}&userId=${recipient.id}`,
    { cookie: senderCookie }
  );
  assert.equal(forgedUserRead.status, 401);
});

test("only an authenticated participant can create a message", async () => {
  const sender = accounts[0];
  const recipient = accounts[1];
  const outsider = accounts[2];
  assert.ok(sender && recipient && outsider);

  const payload = await encryptMessagePayload(
    "authorized message",
    recipient.publicKey,
    sender.publicKey,
    `conversation:${conversationId}:sender:${sender.id}`
  );
  const senderLogin = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: sender.username,
      password: sender.password,
    }),
  });
  const outsiderLogin = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: outsider.username,
      password: outsider.password,
    }),
  });

  const authorizedResponse = await jsonRequest("/api/messages", {
    method: "POST",
    cookie: cookieHeader(senderLogin),
    body: JSON.stringify({
      content: JSON.stringify(payload),
      senderId: sender.id,
      conversationId,
    }),
  });
  assert.equal(authorizedResponse.status, 200);

  const forgedSenderResponse = await jsonRequest("/api/messages", {
    method: "POST",
    cookie: cookieHeader(outsiderLogin),
    body: JSON.stringify({
      content: JSON.stringify(payload),
      senderId: sender.id,
      conversationId,
    }),
  });
  assert.equal(forgedSenderResponse.status, 401);

  const outsiderPayload = await encryptMessagePayload(
    "outsider message",
    recipient.publicKey,
    outsider.publicKey,
    `conversation:${conversationId}:sender:${outsider.id}`
  );
  const outsiderResponse = await jsonRequest("/api/messages", {
    method: "POST",
    cookie: cookieHeader(outsiderLogin),
    body: JSON.stringify({
      content: JSON.stringify(outsiderPayload),
      senderId: outsider.id,
      conversationId,
    }),
  });
  assert.equal(outsiderResponse.status, 403);
});

test("removing a friend deletes the relationship and blocks new messages", async () => {
  const sender = await signupTestAccount("removal_sender");
  accounts.push(sender);
  const recipient = await signupTestAccount("removal_recipient");
  accounts.push(recipient);
  const prisma = await getPrisma();

  await prisma.friendRequest.create({
    data: {
      senderId: sender.id,
      receiverId: recipient.id,
      status: "accepted",
    },
  });
  const conversation = await prisma.conversation.create({
    data: {
      directKey: [sender.id, recipient.id].sort().join(":"),
      participants: {
        connect: [{ id: sender.id }, { id: recipient.id }],
      },
    },
  });

  const login = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: sender.username,
      password: sender.password,
    }),
  });
  const cookie = cookieHeader(login);

  const removeResponse = await jsonRequest("/api/friends/remove", {
    method: "POST",
    cookie,
    body: JSON.stringify({
      userId: sender.id,
      friendId: recipient.id,
    }),
  });
  assert.equal(removeResponse.status, 200);

  const friendship = await prisma.friendRequest.findFirst({
    where: {
      status: "accepted",
      OR: [
        { senderId: sender.id, receiverId: recipient.id },
        { senderId: recipient.id, receiverId: sender.id },
      ],
    },
  });
  assert.equal(friendship, null);

  const payload = await encryptMessagePayload(
    "blocked after removal",
    recipient.publicKey,
    sender.publicKey,
    `conversation:${conversation.id}:sender:${sender.id}`
  );
  const messageResponse = await jsonRequest("/api/messages", {
    method: "POST",
    cookie,
    body: JSON.stringify({
      content: JSON.stringify(payload),
      senderId: sender.id,
      conversationId: conversation.id,
    }),
  });
  assert.equal(messageResponse.status, 403);
});

test("logout revokes the database session and invalidates the old cookie", async () => {
  const user = await signupTestAccount("session_revoke");
  accounts.push(user);

  const login = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: user.username,
      password: user.password,
    }),
  });
  const cookie = cookieHeader(login);

  const beforeLogout = await jsonRequest(
    `/api/conversations?userId=${user.id}`,
    { cookie }
  );
  assert.equal(beforeLogout.status, 200);

  const logout = await jsonRequest("/api/logout", {
    method: "POST",
    cookie,
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/i);

  const afterLogout = await jsonRequest(
    `/api/conversations?userId=${user.id}`,
    { cookie }
  );
  assert.equal(afterLogout.status, 401);

  const prisma = await getPrisma();
  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
  });
  assert.equal(sessions.length, 2);
  assert.equal(sessions.filter((session) => session.revokedAt).length, 1);
  assert.equal(sessions.filter((session) => !session.revokedAt).length, 1);
});

test("an expired database session invalidates an otherwise valid cookie", async () => {
  const user = await signupTestAccount("session_expiry");
  accounts.push(user);

  const login = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: user.username,
      password: user.password,
    }),
  });
  const cookie = cookieHeader(login);
  const sessionId = sessionIdFromCookie(cookie);
  const prisma = await getPrisma();

  await prisma.session.update({
    where: { id: sessionId },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  });

  const protectedResponse = await jsonRequest(
    `/api/conversations?userId=${user.id}`,
    { cookie }
  );
  assert.equal(protectedResponse.status, 401);

  const expiredSession = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
  });
  assert.ok(expiredSession.expiresAt.getTime() < Date.now());
});

test("Socket.IO authenticates users, authorizes rooms, and relays only owned messages", async () => {
  const sender = await signupTestAccount("socket_sender");
  accounts.push(sender);
  const recipient = await signupTestAccount("socket_recipient");
  accounts.push(recipient);
  const outsider = await signupTestAccount("socket_outsider");
  accounts.push(outsider);
  const prisma = await getPrisma();

  await prisma.friendRequest.create({
    data: {
      senderId: sender.id,
      receiverId: recipient.id,
      status: "accepted",
    },
  });
  const conversation = await prisma.conversation.create({
    data: {
      directKey: [sender.id, recipient.id].sort().join(":"),
      participants: {
        connect: [{ id: sender.id }, { id: recipient.id }],
      },
    },
  });

  const senderLogin = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: sender.username,
      password: sender.password,
    }),
  });
  const recipientLogin = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: recipient.username,
      password: recipient.password,
    }),
  });
  const outsiderLogin = await jsonRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: outsider.username,
      password: outsider.password,
    }),
  });
  const senderCookie = cookieHeader(senderLogin);
  const recipientCookie = cookieHeader(recipientLogin);
  const outsiderCookie = cookieHeader(outsiderLogin);

  await assert.rejects(() => connectSocket(), /Unauthorized/);

  const senderSocket = await connectSocket(senderCookie);
  const recipientSocket = await connectSocket(recipientCookie);
  const outsiderSocket = await connectSocket(outsiderCookie);

  try {
    const senderJoin = await new Promise<{ ok: boolean }>((resolve) => {
      senderSocket.emit(
        "join:conversation",
        { conversationId: conversation.id },
        resolve
      );
    });
    assert.deepEqual(senderJoin, { ok: true });

    const recipientJoin = await new Promise<{ ok: boolean }>((resolve) => {
      recipientSocket.emit(
        "join:conversation",
        { conversationId: conversation.id },
        resolve
      );
    });
    assert.deepEqual(recipientJoin, { ok: true });

    const outsiderJoin = await new Promise<{ ok: boolean }>((resolve) => {
      outsiderSocket.emit(
        "join:conversation",
        { conversationId: conversation.id },
        resolve
      );
    });
    assert.deepEqual(outsiderJoin, { ok: false, error: "Unauthorized" });

    const payload = await encryptMessagePayload(
      "realtime message",
      recipient.publicKey,
      sender.publicKey,
      `conversation:${conversation.id}:sender:${sender.id}`
    );
    const messageResponse = await jsonRequest("/api/messages", {
      method: "POST",
      cookie: senderCookie,
      body: JSON.stringify({
        content: JSON.stringify(payload),
        senderId: sender.id,
        conversationId: conversation.id,
      }),
    });
    assert.equal(messageResponse.status, 200);
    const message = (await messageResponse.json()) as { id: string };

    const received = new Promise<Record<string, unknown>>((resolve) => {
      recipientSocket.once("message:received", resolve);
    });
    const senderRelay = await new Promise<{ ok: boolean }>((resolve) => {
      senderSocket.emit(
        "message:received",
        { conversationId: conversation.id, messageId: message.id },
        resolve
      );
    });
    assert.deepEqual(senderRelay, { ok: true });
    assert.deepEqual(await received, {
      conversationId: conversation.id,
      senderId: sender.id,
      messageId: message.id,
      senderUsername: sender.username,
      content: JSON.stringify(payload),
      createdAt: (await prisma.message.findUniqueOrThrow({
        where: { id: message.id },
        select: { createdAt: true },
      })).createdAt.toISOString(),
    });

    const outsiderRelay = await new Promise<{ ok: boolean; error: string }>(
      (resolve) => {
        outsiderSocket.emit(
          "message:received",
          { conversationId: conversation.id, messageId: message.id },
          resolve
        );
      }
    );
    assert.deepEqual(outsiderRelay, {
      ok: false,
      error: "Message not found",
    });
  } finally {
    senderSocket.close();
    recipientSocket.close();
    outsiderSocket.close();
  }
});
