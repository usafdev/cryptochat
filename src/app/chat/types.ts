export interface Friend {
  id: string;
  username: string;
}

export interface FriendRequest {
  id: string;
  status: string;
  senderId: string;
  receiverId: string;
  sender?: { id: string; username: string };
  receiver?: { id: string; username: string };
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
  isOwn: boolean;
}

export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: Date;
  unread: number;
}

export interface Conversation {
  id: string;
  participants: { id: string; username: string; publicKey?: string }[];
  messages: { content: string; createdAt: string }[];
}

export type ChatMessages = Record<string, Message[]>;
