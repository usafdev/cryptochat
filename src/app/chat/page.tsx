// src/app/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "../components/ui/Button";
import { Send, Lock, User, Settings, Search, Smile } from "lucide-react";

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

/* ---------- Friend-request helpers ---------- */
type FriendReq = { from: string; to: string; status: "sent" | "received" | "accepted" };
const REQ_KEY = "friend_requests";

function getReqs(): FriendReq[] {
  const raw = typeof window !== "undefined" ? localStorage.getItem(REQ_KEY) : null;
  return raw ? JSON.parse(raw) : [];
}
function sendRequest(from: string, to: string) {
  const reqs = getReqs();
  if (from === to || reqs.some((r) => r.from === from && r.to === to)) return;
  reqs.push({ from, to, status: "sent" });
  localStorage.setItem(REQ_KEY, JSON.stringify(reqs));
}
function acceptRequest(from: string, to: string) {
  const reqs = getReqs().filter((r) => !(r.from === from && r.to === to));
  reqs.push({ from, to, status: "accepted" });
  localStorage.setItem(REQ_KEY, JSON.stringify(reqs));
}
function declineRequest(from: string, to: string) {
  const reqs = getReqs().filter((r) => !(r.from === from && r.to === to));
  localStorage.setItem(REQ_KEY, JSON.stringify(reqs));
}
function getFriends(): string[] {
  const me = typeof window !== "undefined" ? localStorage.getItem("loggedInUser") : null;
  return getReqs()
    .filter((r) => r.status === "accepted" && (r.from === me || r.to === me))
    .map((r) => (r.from === me ? r.to : r.from));
}

function removeFriend(friend: string) {
  const me = localStorage.getItem("loggedInUser")!;
  const reqs = getReqs().filter(
    (r) => !(r.status === "accepted" && ((r.from === me && r.to === friend) || (r.from === friend && r.to === me)))
  );
  localStorage.setItem(REQ_KEY, JSON.stringify(reqs));
  // also wipe the DM history
  const stateRaw = localStorage.getItem(STORAGE_KEY);
  if (stateRaw) {
    const state = JSON.parse(stateRaw);
    delete state.chatMessages[friend];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

/* ---------- Seed: only Team Crypto ---------- */
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
  const [friends, setFriends] = useState<string[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const EMOJIS = ["😀","😂","😍","🤔","👍","🔥","👀","✅","❤️","🚀","🙌","😎","🤗","😢","😡"];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const loggedInUser = typeof window !== "undefined"
    ? localStorage.getItem("loggedInUser") || "You"
    : "You";

  /* ---------- Sync friends ---------- */
  useEffect(() => setFriends(getFriends()), []);

  /* ---------- Derive chats ---------- */
  const chats = useMemo(() => {
    const team: Chat = {
      id: "team",
      name: "Team Crypto",
      lastMessage: chatMessages["team"]?.slice(-1)[0]?.content || "No messages yet",
      timestamp: chatMessages["team"]?.slice(-1)[0]?.timestamp || new Date(),
      unread: 0,
    };
    const dmChats: Chat[] = friends.map((f) => ({
      id: f,
      name: f,
      lastMessage: chatMessages[f]?.slice(-1)[0]?.content || "No messages yet",
      timestamp: chatMessages[f]?.slice(-1)[0]?.timestamp || new Date(0),
      unread: 0,
    }));
    return [team, ...dmChats].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [friends, chatMessages]);

  const currentMessages = useMemo(
    () => (selectedChat ? chatMessages[selectedChat] ?? [] : []),
    [selectedChat, chatMessages]
  );

  /* ---------- Persistence ---------- */
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
      setChatMessages(revivedChatMessages);
      setSelectedChat(parsed.selectedChat);
    } catch {
      /* ignore */
    }
  }, []);

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
      /* ignore */
    }
  }, [selectedChat, chats, chatMessages]);

  /* ---------- Scroll & focus ---------- */
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [selectedChat, currentMessages.length]);
  useEffect(() => { if (selectedChat) messageInputRef.current?.focus(); }, [selectedChat]);

  /* ---------- Handlers ---------- */
  const handleSelectChat = (chatId: string) => {
    setSelectedChat(chatId);
    setChatMessages((prev) => (prev[chatId] ? prev : { ...prev, [chatId]: [] }));
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || !selectedChat) return;
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

        {/* Friends & Chats */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Send Friend Request */}
          <div className="border-b border-gray-800 pb-3">
            <h3 className="text-sm font-semibold mb-2 text-green-400">Send Request</h3>
            <div className="flex gap-1 mb-2">
              <input
                type="text"
                placeholder="username"
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-green-400"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const input = e.target as HTMLInputElement;
                  const target = input.value.trim();
                  if (!target || target === loggedInUser) return;
                  const users = JSON.parse(localStorage.getItem("users") || "{}");
                  if (!users[target]) { alert("User not found."); return; }
                  sendRequest(loggedInUser, target);
                  setFriends(getFriends()); // re-render
                  input.value = "";
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={(e) => {
                  const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                  const target = input.value.trim();
                  if (!target || target === loggedInUser) return;
                  const users = JSON.parse(localStorage.getItem("users") || "{}");
                  if (!users[target]) { alert("User not found."); return; }
                  sendRequest(loggedInUser, target);
                  setFriends(getFriends());
                  input.value = "";
                }}
              >
                Send
              </Button>
            </div>
          </div>

          {/* Incoming Requests */}
          <div className="border-b border-gray-800 pb-3">
            <h3 className="text-sm font-semibold mb-2 text-green-400">Incoming</h3>
            <ul className="text-xs space-y-1">
              {getReqs()
                .filter((r) => r.to === loggedInUser && r.status !== "accepted")
                .map((r) => (
                  <li key={r.from} className="flex justify-between items-center hover:bg-gray-800 px-1 rounded">
                    <span>{r.from} wants to be friends</span>
                    <div className="space-x-1">
                      <button
                        className="text-green-400"
                        onClick={() => {
                          acceptRequest(r.from, r.to);
                          setFriends(getFriends());
                        }}
                      >
                        ✓
                      </button>
                      <button
                        className="text-red-400"
                        onClick={() => {
                          declineRequest(r.from, r.to);
                          setFriends(getFriends());
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              {getReqs().filter((r) => r.to === loggedInUser && r.status !== "accepted").length === 0 && (
                <p className="text-gray-500 text-xs">No pending requests</p>
              )}
            </ul>
          </div>

          {/* Accepted Friends (DM chats) */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-green-400">Friends</h3>
            {friends.length === 0 && <p className="text-gray-500 text-xs">No friends yet</p>}
              {friends.map((f) => (
                <div
                  key={f}
                  className={`group flex items-center justify-between p-2 hover:bg-gray-900 rounded cursor-pointer ${
                    selectedChat === f ? "bg-gray-900" : ""
                  }`}
                  onClick={(e) => {
                    // ignore if the click bubbled from the remove button
                    if ((e.target as HTMLElement).closest("button")) return;
                    handleSelectChat(f);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-medium truncate text-sm">{f}</span>
                      <span className="text-xs text-gray-500">
                        {formatTime(chatMessages[f]?.slice(-1)[0]?.timestamp || new Date(0))}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {chatMessages[f]?.slice(-1)[0]?.content || "No messages yet"}
                    </p>
                  </div>

                  <button
                    title={`Remove ${f}`}
                    onClick={(e) => {
                      e.stopPropagation(); // block parent click
                      if (window.confirm(`Remove ${f} from friends?`)) {
                        removeFriend(f);
                        setFriends(getFriends());
                        if (selectedChat === f) setSelectedChat(null);
                      }
                    }}
                    className="ml-2 hidden group-hover:block text-red-400 hover:text-red-300 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
          {/* Outgoing Requests */}
            <div className="border-b border-gray-800 pb-3">
              <h3 className="text-sm font-semibold mb-2 text-green-400">Outgoing</h3>
              <ul className="text-xs space-y-1">
                {getReqs()
                  .filter((r) => r.from === loggedInUser && r.status === "sent")
                  .map((r) => (
                    <li key={r.to} className="flex justify-between items-center px-1">
                      <span>→ {r.to}</span>
                      <button
                        className="text-red-400 ml-2"
                        onClick={() => {
                          const reqs = getReqs().filter(
                            (req) => !(req.from === loggedInUser && req.to === r.to)
                          );
                          localStorage.setItem(REQ_KEY, JSON.stringify(reqs));
                          setFriends(getFriends()); // forces re-render
                        }}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                {getReqs().filter((r) => r.from === loggedInUser && r.status === "sent")
                  .length === 0 && (
                  <p className="text-gray-500 text-xs">None</p>
                )}
              </ul>
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

            <div
              className="flex-1 overflow-y-auto p-4 space-y-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {currentMessages.length === 0 && (
                <div className="text-center text-gray-500 text-sm mt-8">No messages yet. Say hi!</div>
              )}
              {currentMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg break-words ${
                      msg.isOwn ? "bg-green-400 text-black" : "bg-gray-800 text-white"
                    }`}
                  >
                    <p className={`text-xs mb-1 ${msg.isOwn ? "text-gray-800" : "text-gray-300"}`}>
                      {msg.sender}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-2xs mt-1 ${msg.isOwn ? "text-gray-700" : "text-gray-400"}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-800">
              <div className="flex gap-2 items-end">
                {/* message box */}
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
                  {/* emoji toggle */}
                  <button
                    type="button"
                    onClick={() => setShowEmoji(!showEmoji)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    aria-label="Open emoji palette"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  {/* static emoji palette */}
                  {showEmoji && (
                    <div className="absolute bottom-full mb-2 right-0 z-20 grid grid-cols-5 gap-1 p-2 bg-gray-900 border border-gray-700 rounded">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          onClick={() => {
                            setMessage((m) => m + e);
                            setShowEmoji(false); // close after pick (or remove this line to keep open)
                          }}
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
    const username = localStorage.getItem("loggedInUser");
    if (!username) router.push("/login");
    else setLoggedInUser(username);
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
        className="absolute top-4 right-4 px-3 py-1 border border-gray-700 text-sm text-gray-300 rounded hover:bg-red-500 hover:text-white"
      >
        Logout
      </button>
      <ChatShell />
    </div>
  );
}