import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
const joinedConversations = new Set<string>();

export function getSocket() {
  if (!socket) {
    socket = io({
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
    socket.on("connect", () => {
      for (const conversationId of joinedConversations) {
        socket?.emit("join:conversation", { conversationId });
      }
    });
  }

  return socket;
}

export function joinConversationRoom(conversationId: string, userId: string) {
  const currentSocket = getSocket();
  joinedConversations.add(conversationId);
  currentSocket.emit("join:conversation", { conversationId, userId });
}

export function relayLiveMessage(payload: {
  conversationId: string;
  messageId: string;
}): Promise<void> {
  const currentSocket = getSocket();
  return new Promise((resolve, reject) => {
    if (!currentSocket.connected) {
      reject(new Error("Realtime connection is unavailable"));
      return;
    }
    currentSocket.timeout(5000).emit("message:received", payload, (error?: Error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
