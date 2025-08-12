// src/app/page.tsx
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "../components/ui/Button";
import { Send, Lock, User, Settings, Search, Plus } from "lucide-react";

interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
  isOwn: boolean;
}

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: Date;
  unread: number;
}

type ChatMessages = Record<string, Message[]>;

const STORAGE_KEY = "cryptochat_state_v1";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Seed data
const now = new Date();
const initialChatMessages: ChatMessages = {
  "1": [
    {
      id: uid(),
      content: "Hey, how are you?",
      sender: "Alice",
      timestamp: now,
      isOwn: false,
    },
  ],
  "2": [
    {
      id: uid(),
      content: "Meeting at 3pm",
      sender: "Bob",
      timestamp: now,
      isOwn: false,
    },
  ],
  "3": [
    {
      id: uid(),
      content: "New encryption protocol deployed",
      sender: "Team Crypto",
      timestamp: now,
      isOwn: false,
    },
  ],
};

const initialChats: Chat[] = [
  {
    id: "1",
    name: "Alice",
    lastMessage: initialChatMessages["1"][0].content,
    timestamp: initialChatMessages["1"][0].timestamp,
    unread: 2,
  },
  {
    id: "2",
    name: "Bob",
    lastMessage: initialChatMessages["2"][0].content,
    timestamp: initialChatMessages["2"][0].timestamp,
    unread: 0,
  },
  {
    id: "3",
    name: "Team Crypto",
    lastMessage: initialChatMessages["3"][0].content,
    timestamp: initialChatMessages["3"][0].timestamp,
    unread: 5,
  },
];

export default function CryptoChat() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [chatMessages, setChatMessages] = useState<ChatMessages>(initialChatMessages);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const currentMessages = useMemo(
    () => (selectedChat ? chatMessages[selectedChat] ?? [] : []),
    [selectedChat, chatMessages]
  );

  // Load from localStorage on first mount
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        selectedChat: string | null;
        chats: (Omit<Chat, "timestamp"> & { timestamp: string })[];
        chatMessages: Record<string, (Omit<Message, "timestamp"> & { timestamp: string })[]>;
      };

      const revivedChats: Chat[] = parsed.chats.map((c) => ({
        ...c,
        timestamp: new Date(c.timestamp),
      }));

      const revivedChatMessages: ChatMessages = Object.fromEntries(
        Object.entries(parsed.chatMessages).map(([chatId, msgs]) => [
          chatId,
          msgs.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
        ])
      );

      setChats(revivedChats);
      setChatMessages(revivedChatMessages);
      setSelectedChat(parsed.selectedChat);
    } catch {
      // If parsing fails, fall back to initial state
    }
  }, []);

  // Persist to localStorage when state changes
  useEffect(() => {
    try {
      const payload = {
        selectedChat,
        chats: chats.map((c) => ({ ...c, timestamp: c.timestamp.toISOString() })),
        chatMessages: Object.fromEntries(
          Object.entries(chatMessages).map(([id, msgs]) => [
            id,
            msgs.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })),
          ])
        ),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, [selectedChat, chats, chatMessages]);

  // Auto scroll to bottom when messages update or chat changes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedChat, currentMessages.length]);

  // Focus the input when a chat is selected
  useEffect(() => {
    if (selectedChat) messageInputRef.current?.focus();
  }, [selectedChat]);

  const handleSelectChat = (chatId: string) => {
    setSelectedChat(chatId);
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c))
    );
    // Ensure a message array exists for new/empty chats
    setChatMessages((prev) => (prev[chatId] ? prev : { ...prev, [chatId]: [] }));
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || !selectedChat) return;

    const newMsg: Message = {
      id: uid(),
      content: trimmed,
      sender: "You",
      timestamp: new Date(),
      isOwn: true,
    };

    setChatMessages((prev) => {
      const chatMsgs = prev[selectedChat] ?? [];
      const nextMsgs = [...chatMsgs, newMsg];
      return { ...prev, [selectedChat]: nextMsgs };
    });

    // Update chat metadata (lastMessage, timestamp). Do not alter unread of the selected chat.
    setChats((prev) =>
      prev
        .map((c) =>
          c.id === selectedChat
            ? { ...c, lastMessage: trimmed, timestamp: newMsg.timestamp }
            : c
        )
        // Optional: keep chats sorted by recent activity (desc)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    );

    setMessage("");
    // Scroll after a tick to ensure DOM updates
    requestAnimationFrame(scrollToBottom);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    const name = typeof window !== "undefined" ? window.prompt("Name this chat") : null;
    if (!name) return;

    const id = uid();
    const createdAt = new Date();

    const newChat: Chat = {
      id,
      name: name.trim(),
      lastMessage: "",
      timestamp: createdAt,
      unread: 0,
    };

    setChats((prev) =>
      [newChat, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    );
    setChatMessages((prev) => ({ ...prev, [id]: [] }));
    setSelectedChat(id);
  };

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? chats.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.lastMessage || "").toLowerCase().includes(q)
        )
      : chats;
    return [...base].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [chats, search]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2" aria-label="App title">
              <Lock className="w-5 h-5 text-green-400" />
              CryptoChat
            </h1>
            <Button variant="ghost" size="icon" aria-label="Open settings">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              aria-label="Search chats"
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-green-400"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <Button
              className="w-full justify-start"
              variant="ghost"
              aria-label="Create new chat"
              onClick={handleNewChat}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`p-4 hover:bg-gray-900 cursor-pointer border-b border-gray-800 ${
                selectedChat === chat.id ? "bg-gray-900" : ""
              }`}
              onClick={() => handleSelectChat(chat.id)}
              role="button"
              aria-pressed={selectedChat === chat.id}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelectChat(chat.id);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{chat.name}</h3>
                  <p className="text-sm text-gray-400 truncate">{chat.lastMessage || "No messages yet"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{formatTime(chat.timestamp)}</span>
                  {chat.unread > 0 && (
                    <span
                      className="bg-green-400 text-black text-xs rounded-full px-2 py-1"
                      aria-label={`${chat.unread} unread messages`}
                    >
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center"
                  aria-hidden="true"
                >
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold">
                    {chats.find((c) => c.id === selectedChat)?.name || "Chat"}
                  </h2>
                  <p className="text-sm text-green-400" aria-label="Online status">
                    ● Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-400" aria-hidden="true" />
                <span className="text-sm text-gray-400">End-to-end encrypted</span>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {currentMessages.length === 0 && (
                <div className="text-center text-gray-500 text-sm mt-8">
                  No messages yet. Say hi!
                </div>
              )}
              {currentMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg break-words ${
                      msg.isOwn ? "bg-green-400 text-black" : "bg-gray-800 text-white"
                    }`}
                  >
                    {!msg.isOwn && (
                      <p className="text-xs text-gray-300 mb-1">{msg.sender}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p
                      className={`text-2xs mt-1 ${
                        msg.isOwn ? "text-gray-700" : "text-gray-400"
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-800">
              <div className="flex gap-2">
                <input
                  ref={messageInputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a secure message..."
                  aria-label="Type a message"
                  className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                />
                <Button
                  onClick={handleSend}
                  className="bg-green-400 text-black hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                  disabled={!message.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Lock className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to CryptoChat</h2>
              <p className="text-gray-400">Select a chat to start secure messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}