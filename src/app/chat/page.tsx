// src/app/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
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

export default function CryptoChat() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([
    {
      id: "1",
      name: "Alice",
      lastMessage: "Hey, how are you?",
      timestamp: new Date(),
      unread: 2,
    },
    {
      id: "2",
      name: "Bob",
      lastMessage: "Meeting at 3pm",
      timestamp: new Date(),
      unread: 0,
    },
    {
      id: "3",
      name: "Team Crypto",
      lastMessage: "New encryption protocol deployed",
      timestamp: new Date(),
      unread: 5,
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: message,
      sender: "You",
      timestamp: new Date(),
      isOwn: true,
    };

    setMessages([...messages, newMessage]);
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-black">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-green-400" />
              CryptoChat
            </h1>
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-green-400"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <Button className="w-full justify-start" variant="ghost">
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`p-4 hover:bg-gray-900 cursor-pointer border-b border-gray-800 ${
                selectedChat === chat.id ? "bg-gray-900" : ""
              }`}
              onClick={() => {
                setSelectedChat(chat.id);

                // Reset unread count for this chat
                setChats((prevChats) =>
                  prevChats.map((c) =>
                    c.id === chat.id ? { ...c, unread: 0 } : c
                  )
                );

                // Set example messages for the selected chat
                setMessages([
                  {
                    id: "1",
                    content: "Hello! This is a secure conversation.",
                    sender: chat.name,
                    timestamp: new Date(),
                    isOwn: false,
                  },
                ]);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{chat.name}</h3>
                  <p className="text-sm text-gray-400 truncate">{chat.lastMessage}</p>
                </div>
                {chat.unread > 0 && (
                  <span className="bg-green-400 text-black text-xs rounded-full px-2 py-1">
                    {chat.unread}
                  </span>
                )}
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
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold">
                    {chats.find((c) => c.id === selectedChat)?.name}
                  </h2>
                  <p className="text-sm text-green-400">● Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">End-to-end encrypted</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.isOwn
                        ? "bg-green-400 text-black"
                        : "bg-gray-800 text-white"
                    }`}
                  >
                    {!msg.isOwn && (
                      <p className="text-xs text-gray-400 mb-1">{msg.sender}</p>
                    )}
                    <p className="text-sm">{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.isOwn ? "text-gray-700" : "text-gray-400"
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a secure message..."
                  className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                />
                <Button
                  onClick={handleSend}
                  className="bg-green-400 text-black hover:bg-green-500"
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