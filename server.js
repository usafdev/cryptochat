const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join:conversation", ({ conversationId, userId }) => {
      if (!conversationId || !userId) {
        return;
      }

      socket.data.userId = userId;
      socket.join(conversationId);
    });

    socket.on("message:received", (payload) => {
      if (!payload?.conversationId || !payload?.senderId || !payload?.messageId) {
        return;
      }

      socket.to(payload.conversationId).emit("message:received", payload);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> CryptoChat ready on http://${hostname}:${port}`);
  });
});
