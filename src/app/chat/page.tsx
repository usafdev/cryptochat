// src/app/chat/page.tsx
"use client";

import { sendMessage } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "../components/ui/Button";
import { Send, Lock, User, Settings, Search, Smile } from "lucide-react";

interface Friend {
  id: string;
  username: string;
}

interface FriendRequest {
  id: string;
  status: string;
  senderId: string;
  receiverId: string;
  sender?: { id: string; username: string };
  receiver?: { id: string; username: string };
}

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

interface Conversation {
  id: string;
  participants: { id: string; username: string }[];
  messages: { content: string; createdAt: string }[];
}

type ChatMessages = Record<string, Message[]>;

const STORAGE_KEY = "cryptochat_state_v1";
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const now = new Date();
const initialChatMessages: ChatMessages = {
  team: [
    {
      id: uid(),
      content: "Welcome to CryptoChat – secure messaging for everyone.",
      sender: "Team Crypto",
      timestamp: now,
      isOwn: false,
    },
  ],
};

function ChatShell() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessages>(initialChatMessages);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<string>("You");

  const EMOJIS = ["😀","😂","😍","🤔","👍","🔥","👀","✅","❤️","🚀","🙌","😎","🤗","😢","😡"];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Initialize user data from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
        if (user.id) {
          setUserId(user.id);
          setLoggedInUser(user.username || "You");
        } else {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      }
    }
  }, [router]);

  async function sendFriendRequest(senderId: string, receiverId: string) {
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderId, receiverId }),
    });
    if (res.ok) loadFriendsAndConversations();
    return res.json();
  }

  async function acceptFriendRequest(requestId: string) {
    const res = await fetch("/api/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (res.ok) loadFriendsAndConversations();
    return res.json();
  }

  async function declineFriendRequest(requestId: string) {
    const res = await fetch("/api/friends/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (res.ok) loadFriendsAndConversations();
    return res.json();
  }

  async function cancelFriendRequest(requestId: string, currentUserId: string) {
    const res = await fetch("/api/friends/cancel", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, userId: currentUserId }),
    });
    if (res.ok) loadFriendsAndConversations();
    return res.json();
  }

  async function removeFriend(friendId: string) {
    if (!userId) return;
    const res = await fetch("/api/friends/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, friendId }),
    });
    if (res.ok) loadFriendsAndConversations();
    return res.json();
  }

  async function loadFriendsAndConversations() {
    if (!userId) return;
    try {
      const [friendsRes, convRes] = await Promise.all([
        fetch(`/api/friends?userId=${userId}`),
        fetch(`/api/conversations?userId=${userId}`)
      ]);

      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        setFriends(friendsData.friends ?? []);
        setRequests(friendsData.requests ?? []);
      }

      if (convRes.ok) {
        const convData = await convRes.json();
        setConversations(convData);
      }
    } catch (error) {
      console.error("loadFriendsAndConversations error:", error);
    }
  }

  useEffect(() => {
    if (userId) {
      loadFriendsAndConversations();
    }
  }, [userId]);

  // Fetch messages from DB whenever a chat is selected and userId is ready
  useEffect(() => {
    if (!selectedChat || selectedChat === "team" || !userId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages?conversationId=${selectedChat}`);
        if (res.ok) {
          const msgs = await res.json();
          const formattedMsgs: Message[] = msgs.map((m: any) => ({
            id: m.id,
            content: m.content,
            sender: m.sender?.username || "Unknown",
            timestamp: new Date(m.createdAt),
            isOwn: m.senderId === userId,
          }));
          
          setChatMessages((prev) => ({
            ...prev,
            [selectedChat]: formattedMsgs,
          }));
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    };

    fetchMessages();
  }, [selectedChat, userId]);

  const chats = useMemo(() => {
    const team: Chat = {
      id: "team",
      name: "Team Crypto",
      lastMessage: chatMessages["team"]?.slice(-1)[0]?.content || "No messages yet",
      timestamp: chatMessages["team"]?.slice(-1)[0]?.timestamp || new Date(),
      unread: 0,
    };

    const dmChats: Chat[] = conversations.map((conv) => {
      const otherParticipant = conv.participants.find((p) => p.id !== userId);
      const friendName = otherParticipant?.username || "Unknown";
      const lastMsg = conv.messages[0]; // ordered desc, take 1
      
      return {
        id: conv.id,
        name: friendName,
        lastMessage: lastMsg?.content || "No messages yet",
        timestamp: lastMsg ? new Date(lastMsg.createdAt) : new Date(0),
        unread: 0,
      };
    });

    return [team, ...dmChats].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [conversations, chatMessages, userId]);

  const currentMessages = useMemo(
    () => (selectedChat ? chatMessages[selectedChat] ?? [] : []),
    [selectedChat, chatMessages]
  );

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        selectedChat: string | null;
        chatMessages: Record<string, (Omit<Message, "timestamp"> & { timestamp: string })[]>;
      };
      const revivedChatMessages: ChatMessages = Object.fromEntries(
        Object.entries(parsed.chatMessages ?? {}).map(([chatId, msgs]) => [
          chatId,
          msgs.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
        ])
      );
      setChatMessages((prev) => ({ ...prev, ...revivedChatMessages }));
      setSelectedChat(parsed.selectedChat);
    } catch { /* ignore */ }
  }, []);

  // Save state to localStorage on change
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
    } catch { /* ignore */ }
  }, [selectedChat, chats, chatMessages]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [selectedChat, currentMessages.length]);
  useEffect(() => { if (selectedChat) messageInputRef.current?.focus(); }, [selectedChat]);

  const handleSelectChat = (chatId: string) => {
    setSelectedChat(chatId);
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || !selectedChat || !userId) return;

    if (selectedChat === "team") {
      const newMsg: Message = {
        id: uid(),
        content: trimmed,
        sender: loggedInUser,
        timestamp: new Date(),
        isOwn: true,
      };
      setChatMessages((prev) => ({
        ...prev,
        [selectedChat]: [...(prev[selectedChat] ?? []), newMsg],
      }));
      setMessage("");
      requestAnimationFrame(scrollToBottom);
      return;
    }

    try {
      const savedMessage = await sendMessage(selectedChat, trimmed, userId);

      const newMsg: Message = {
        id: savedMessage.id,
        content: savedMessage.content,
        sender: loggedInUser,
        timestamp: new Date(savedMessage.createdAt),
        isOwn: true,
      };

      setChatMessages((prev) => ({
        ...prev,
        [selectedChat]: [...(prev[selectedChat] ?? []), newMsg],
      }));

      setMessage("");
      requestAnimationFrame(scrollToBottom);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to send message");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
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

        {/* Scrollable Friends & Chats Area */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div className="border-b border-gray-800 pb-3">
            <h3 className="text-sm font-semibold mb-2 text-green-400">Send Request</h3>
            <div className="flex gap-1 mb-2">
              <input
                type="text"
                placeholder="username"
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-green-400"
                onKeyDown={async (e) => {
                  if (e.key !== "Enter") return;
                  const input = e.target as HTMLInputElement;
                  const target = input.value.trim();
                  if (!target || target === loggedInUser || !userId) return;
                  
                  const response = await fetch(`/api/users?username=${target}`);
                  const users = await response.json();
                  if (users.length === 0) { alert("User not found."); return; }

                  await sendFriendRequest(userId, users[0].id);
                  input.value = "";
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={async (e) => {
                  const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                  const target = input.value.trim();
                  if (!target || target === loggedInUser || !userId) return;

                  const response = await fetch(`/api/users?username=${target}`);
                  const users = await response.json();
                  if (users.length === 0) { alert("User not found."); return; }

                  await sendFriendRequest(userId, users[0].id);
                  input.value = "";
                }}
              >
                Send
              </Button>
            </div>
          </div>

          <div className="border-b border-gray-800 pb-3">
            <h3 className="text-sm font-semibold mb-2 text-green-400">Incoming</h3>
            <ul className="text-xs space-y-1">
              {requests.filter((r) => r.status === "pending" && r.receiverId === userId).map((r) => (
                <li key={r.id} className="flex justify-between items-center hover:bg-gray-800 px-1 rounded">
                  <span>{r.sender?.username} wants to be friends</span>
                  <div className="space-x-1">
                    <button className="text-green-400" onClick={() => acceptFriendRequest(r.id)}>✓</button>
                    <button className="text-red-400" onClick={() => declineFriendRequest(r.id)}>✕</button>
                  </div>
                </li>
              ))}
              {requests.filter((r) => r.status === "pending" && r.receiverId === userId).length === 0 && (
                <p className="text-gray-500 text-xs">No pending requests</p>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 text-green-400">Friends</h3>
            {friends.length === 0 && <p className="text-gray-500 text-xs">No friends yet</p>}
            {chats.filter(c => c.id !== "team").map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center justify-between p-2 hover:bg-gray-900 rounded cursor-pointer ${
                  selectedChat === chat.id ? "bg-gray-900" : ""
                }`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  handleSelectChat(chat.id);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate text-sm">{chat.name}</span>
                    <span className="text-xs text-gray-500">{formatTime(chat.timestamp)}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{chat.lastMessage}</p>
                </div>
                <button
                  title={`Remove ${chat.name}`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const friend = friends.find(f => f.username === chat.name);
                    if (friend && window.confirm(`Remove ${chat.name} from friends?`)) {
                      await removeFriend(friend.id);
                      if (selectedChat === chat.id) setSelectedChat(null);
                    }
                  }}
                  className="ml-2 hidden group-hover:block text-red-400 hover:text-red-300 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="border-b border-gray-800 pb-3">
            <h3 className="text-sm font-semibold mb-2 text-green-400">Outgoing</h3>
            {requests.filter((r) => r.status === "pending" && r.senderId === userId).map((r) => (
              <div key={r.id} className="flex justify-between items-center text-xs hover:bg-gray-800 px-1 rounded">
                <span>→ {r.receiver?.username || "Unknown"}</span>
                <button className="text-red-400" onClick={() => userId && cancelFriendRequest(r.id, userId)}>✕</button>
              </div>
            ))}
            {requests.filter((r) => r.status === "pending" && r.senderId === userId).length === 0 && (
              <p className="text-gray-500 text-xs">None</p>
            )}
          </div>
        </div>

        {/* 🌟 NEW: Logged-in User Footer */}
        <div className="p-4 border-t border-gray-800 flex items-center gap-3 bg-gray-900/50">
          <div className="w-9 h-9 bg-green-400 rounded-full flex items-center justify-center text-black font-bold text-sm shrink-0">
            {loggedInUser ? loggedInUser.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{loggedInUser}</p>
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              Online
            </p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold">{chats.find((c) => c.id === selectedChat)?.name}</h2>
                  <p className="text-sm text-green-400">● Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">End-to-end encrypted</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite" aria-relevant="additions text">
              {currentMessages.length === 0 && (
                <div className="text-center text-gray-500 text-sm mt-8">No messages yet. Say hi!</div>
              )}
              {currentMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg break-words ${msg.isOwn ? "bg-green-400 text-black" : "bg-gray-800 text-white"}`}>
                    <p className={`text-xs mb-1 ${msg.isOwn ? "text-gray-800" : "text-gray-300"}`}>{msg.sender}</p>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-2xs mt-1 ${msg.isOwn ? "text-gray-700" : "text-gray-400"}`}>{formatTime(msg.timestamp)}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-800">
              <div className="flex gap-2 items-end">
                <div className="relative flex-1">
                  <input
                    ref={messageInputRef}
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a secure message..."
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:border-green-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmoji(!showEmoji)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    aria-label="Open emoji palette"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  {showEmoji && (
                    <div className="absolute bottom-full mb-2 right-0 z-20 grid grid-cols-5 gap-1 p-2 bg-gray-900 border border-gray-700 rounded">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          onClick={() => { setMessage((m) => m + e); setShowEmoji(false); }}
                          className="text-xl p-1 rounded hover:bg-gray-700"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleSend}
                  className="bg-green-400 text-black hover:bg-green-500 disabled:opacity-50"
                  disabled={!message.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center pt-20">
            <Lock className="w-16 h-16 text-gray-700 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome to CryptoChat</h2>
            <p className="text-gray-400">Select a chat to start secure messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}

/*  Auth wrapper  */
export default function CryptoChat() {
  const router = useRouter();
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
      if (!user.id) {
        router.push("/login");
      } else {
        setLoggedInUser(user.username);
      }
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("loggedInUser");
    router.push("/");
  };

  if (loggedInUser === null) return null;

  return (
    <div className="relative h-screen">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 px-3 py-1 border border-gray-700 text-sm text-gray-300 rounded hover:bg-red-500 hover:text-white z-50"
      >
        Logout
      </button>
      <ChatShell />
    </div>
  );
}