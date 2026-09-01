import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }

  return socket;
}

export function joinConversationRoom(conversationId: string, userId: string) {
  const currentSocket = getSocket();
  currentSocket.emit("join:conversation", { conversationId, userId });
}

export function relayLiveMessage(payload: {
  conversationId: string;
  senderId: string;
  messageId: string;
  senderUsername: string;
  content: string;
  createdAt: string;
}) {
  const currentSocket = getSocket();
  currentSocket.emit("message:received", payload);
}
