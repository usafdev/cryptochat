const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { createHmac, timingSafeEqual } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const developmentSessionSecret = "dev-only-session-secret-please-change";
const sessionSecret = dev
  ? process.env.SESSION_SECRET || developmentSessionSecret
  : process.env.SESSION_SECRET;
const sessionCookieName = "cryptochat_session";
const prisma = new PrismaClient();
let server;
let io;
let shuttingDown = false;

function getAppOrigin() {
  const configuredOrigin = process.env.APP_ORIGIN;
  if (!dev && !configuredOrigin) {
    throw new Error("APP_ORIGIN must be configured in production");
  }

  const origin = configuredOrigin || "http://localhost:3000";
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error("APP_ORIGIN must be a valid HTTP(S) URL");
  }

  if (
    !["http:", "https:"].includes(parsedOrigin.protocol) ||
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.search ||
    parsedOrigin.hash
  ) {
    throw new Error("APP_ORIGIN must be a valid HTTP(S) origin without a path or credentials");
  }

  return parsedOrigin.origin;
}

if (!dev) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters in production");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured in production");
  }
}
const appOrigin = getAppOrigin();

function getSessionUser(cookieHeader) {
  const token = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))
    ?.slice(sessionCookieName.length + 1);

  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = createHmac("sha256", sessionSecret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.userId && decoded.exp >= Date.now() ? decoded : null;
  } catch {
    return null;
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  io = new Server(server, {
    cors: {
      origin: appOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const user = getSessionUser(socket.handshake.headers.cookie);
    if (!user) {
      return next(new Error("Unauthorized"));
    }
    socket.data.userId = user.userId;
    next();
  });

  io.on("connection", (socket) => {
    socket.on("join:conversation", async ({ conversationId }, acknowledge) => {
      if (!conversationId) {
        acknowledge?.({ ok: false, error: "Conversation is required" });
        return;
      }

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          participants: { some: { id: socket.data.userId } },
        },
        select: { id: true },
      });
      if (conversation) {
        socket.join(conversation.id);
        acknowledge?.({ ok: true });
      } else {
        acknowledge?.({ ok: false, error: "Unauthorized" });
      }
    });

    socket.on("message:received", async (payload, acknowledge) => {
      if (!payload?.conversationId || !payload?.messageId) {
        acknowledge?.({ ok: false, error: "Invalid message" });
        return;
      }

      const message = await prisma.message.findFirst({
        where: {
          id: payload.messageId,
          conversationId: payload.conversationId,
          senderId: socket.data.userId,
        },
        include: {
          sender: { select: { username: true } },
        },
      });
      if (!message) {
        acknowledge?.({ ok: false, error: "Message not found" });
        return;
      }

      socket.to(payload.conversationId).emit("message:received", {
        conversationId: message.conversationId,
        senderId: message.senderId,
        messageId: message.id,
        senderUsername: message.sender.username,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      });
      acknowledge?.({ ok: true });
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> CryptoChat ready on http://${hostname}:${port}`);
  });
}).catch(async (error) => {
  console.error("Failed to start CryptoChat", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`> ${signal} received, shutting down CryptoChat`);

  io?.close();
  await new Promise((resolve) => {
    if (!server?.listening) {
      resolve();
      return;
    }
    server.close(resolve);
  });
  await prisma.$disconnect();
}

process.once("SIGINT", () => {
  shutdown("SIGINT").then(() => process.exit(0));
});
process.once("SIGTERM", () => {
  shutdown("SIGTERM").then(() => process.exit(0));
});
