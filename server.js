const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { createHmac, timingSafeEqual } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET || "dev-only-session-secret-please-change";
const sessionCookieName = "cryptochat_session";
const prisma = new PrismaClient();

if (!dev && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be configured in production");
}

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
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: process.env.APP_ORIGIN || "http://localhost:3000",
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
    socket.on("join:conversation", async ({ conversationId }) => {
      if (!conversationId) {
        return;
      }

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          participants: { some: { id: socket.data.userId } },
        },
        select: { id: true },
      });
      if (conversation) socket.join(conversation.id);
    });

    socket.on("message:received", async (payload) => {
      if (!payload?.conversationId || !payload?.senderId || !payload?.messageId) {
        return;
      }

      if (payload.senderId !== socket.data.userId) return;
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: payload.conversationId,
          participants: { some: { id: socket.data.userId } },
        },
        select: { id: true },
      });
      if (!conversation) return;

      socket.to(payload.conversationId).emit("message:received", payload);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> CryptoChat ready on http://${hostname}:${port}`);
  });
});
