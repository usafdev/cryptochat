"use client";

import { sendMessage } from "@/lib/api";
import { decryptMessagePayload } from "@/lib/crypto";
import { getSocket, joinConversationRoom, relayLiveMessage } from "@/lib/socket";
import { ChatSidebar } from "./components/ChatSidebar";
import { ConversationView } from "./components/ConversationView";
import { Toast, type ToastMessage } from "./components/Toast";
import type { Chat, ChatMessages, Conversation, Friend, FriendRequest, Message } from "./types";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import type { KeyboardEvent } from "react";

const STORAGE_KEY = "cryptochat_state_v1";
const KEY_STORAGE_KEY = "cryptochat_key_material_v1";
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
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [messageCursors, setMessageCursors] = useState<Record<string, string | null>>({});
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [keyUnavailable, setKeyUnavailable] = useState(false);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<string>("You");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const loadingOlderRef = useRef(false);
  const router = useRouter();

  const notify = useCallback((message: ToastMessage) => {
    setToast(message);
  }, []);

  const getStoredPrivateKey = useCallback(() => {
    if (typeof window === "undefined") return null;

    try {
      const keyMaterial = JSON.parse(sessionStorage.getItem(KEY_STORAGE_KEY) || "null");
      return typeof keyMaterial?.privateKey === "string" ? keyMaterial.privateKey : null;
    } catch {
      return null;
    }
  }, []);

  const getStoredPublicKey = useCallback(() => {
    if (typeof window === "undefined") return null;

    try {
      const keyMaterial = JSON.parse(sessionStorage.getItem(KEY_STORAGE_KEY) || "null");
      return typeof keyMaterial?.publicKey === "string" ? keyMaterial.publicKey : null;
    } catch {
      return null;
    }
  }, []);

  // Initialize user data from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
        if (user.id) {
          setUserId(user.id);
          setLoggedInUser(user.username || "You");
          if (!getStoredPrivateKey()) {
            setKeyUnavailable(true);
          }
        } else {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      }
    }
  }, [getStoredPrivateKey, router]);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      if (typeof window !== "undefined") {
        localStorage.removeItem("loggedInUser");
        sessionStorage.removeItem(KEY_STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      }
      router.push("/");
    } catch (error) {
      console.error(error);
      notify({ kind: "error", text: "Unable to log out. Please try again." });
    }
  };

  async function sendFriendRequest(username: string) {
    if (!userId) return;
    const searchResponse = await fetch(`/api/users?username=${encodeURIComponent(username)}`);
    const users = await searchResponse.json();
    if (!searchResponse.ok) throw new Error(users.error || "Unable to find that user");
    if (users.length === 0) throw new Error("User not found");
    if (users[0].id === userId) throw new Error("You cannot send a request to yourself");

    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderId: userId, receiverId: users[0].id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to send friend request");
    await loadFriendsAndConversations();
    notify({ kind: "success", text: `Friend request sent to ${users[0].username}` });
  }

  async function acceptFriendRequest(requestId: string) {
    const res = await fetch("/api/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to accept request");
    await loadFriendsAndConversations();
    notify({ kind: "success", text: "Friend request accepted" });
  }

  async function declineFriendRequest(requestId: string) {
    const res = await fetch("/api/friends/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to decline request");
    await loadFriendsAndConversations();
    notify({ kind: "success", text: "Friend request declined" });
  }

  async function cancelFriendRequest(requestId: string) {
    if (!userId) return;
    const res = await fetch("/api/friends/cancel", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to cancel request");
    await loadFriendsAndConversations();
    notify({ kind: "success", text: "Friend request cancelled" });
  }

  async function removeFriend(friendId: string, chatId: string) {
    if (!userId) return;
    const res = await fetch("/api/friends/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, friendId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to remove friend");
    if (selectedChat === chatId) setSelectedChat(null);
    await loadFriendsAndConversations();
    notify({ kind: "success", text: "Friend removed" });
  }

  const loadFriendsAndConversations = useCallback(async () => {
    if (!userId) return;
    setLoadingData(true);
    try {
      const [friendsRes, convRes] = await Promise.all([
        fetch(`/api/friends?userId=${userId}`),
        fetch(`/api/conversations?userId=${userId}`)
      ]);

      const friendsData = await friendsRes.json();
      const convData = await convRes.json();
      if (!friendsRes.ok) throw new Error(friendsData.error || "Unable to load friends");
      if (!convRes.ok) throw new Error(convData.error || "Unable to load conversations");
      setFriends(friendsData.friends ?? []);
      setRequests(friendsData.requests ?? []);
      setConversations(convData);
    } catch (error) {
      console.error("loadFriendsAndConversations error:", error);
      notify({ kind: "error", text: error instanceof Error ? error.message : "Unable to load chats" });
    } finally {
      setLoadingData(false);
    }
  }, [notify, userId]);

  useEffect(() => {
    if (userId) {
      loadFriendsAndConversations();
    }
  }, [userId, loadFriendsAndConversations]);

  useEffect(() => {
    if (!userId) return;

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    const handleIncomingMessage = async (payload: {
      conversationId: string;
      senderId: string;
      messageId: string;
      senderUsername: string;
      content: string;
      createdAt: string;
    }) => {
      if (payload.senderId === userId) return;

      const privateKey = getStoredPrivateKey();
      let content = payload.content;

      if (privateKey && content) {
        const decrypted = await decryptMessagePayload(
          content,
          privateKey,
          `conversation:${payload.conversationId}:sender:${payload.senderId}`
        );
        if (decrypted) {
          content = decrypted;
        } else if (content.startsWith('{"version":"v2"')) {
          content = "[Unable to decrypt message]";
        }
      }

      setChatMessages((prev) => {
        const existing = prev[payload.conversationId] ?? [];
        if (existing.some((item) => item.id === payload.messageId)) return prev;
        return {
        ...prev,
        [payload.conversationId]: [
          ...existing,
          {
            id: payload.messageId,
            content,
            sender: payload.senderUsername,
            timestamp: new Date(payload.createdAt),
            isOwn: false,
          },
        ],
        };
      });
    };

    socket.on("message:received", handleIncomingMessage);

    return () => {
      socket.off("message:received", handleIncomingMessage);
    };
  }, [userId, getStoredPrivateKey]);

  useEffect(() => {
    if (!userId || !selectedChat || selectedChat === "team") return;

    joinConversationRoom(selectedChat, userId);
  }, [selectedChat, userId]);

  // Fetch messages from DB whenever a chat is selected and userId is ready
  useEffect(() => {
    if (!selectedChat || selectedChat === "team" || !userId) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        // SECURITY: Pass userId to verify authorization on the backend
        const res = await fetch(`/api/messages?conversationId=${selectedChat}&userId=${userId}&limit=50`);
        
        if (res.ok) {
          const result = await res.json();
          const msgs = result.messages ?? [];
          const privateKey = getStoredPrivateKey();

          const formattedMsgs: Message[] = await Promise.all(msgs.map(async (m: {
            id: string;
            content: string;
            sender?: { username?: string };
            createdAt: string;
            senderId: string;
          }) => {
            let content = m.content;

            if (privateKey && content) {
              const decrypted = await decryptMessagePayload(
                content,
                privateKey,
                `conversation:${selectedChat}:sender:${m.senderId}`
              );
              if (decrypted) {
                content = decrypted;
              } else if (content.startsWith('{"version":"v2"')) {
                content = "[Unable to decrypt message]";
              }
            }

            return {
              id: m.id,
              content,
              sender: m.sender?.username || "Unknown",
              timestamp: new Date(m.createdAt),
              isOwn: m.senderId === userId,
            };
          }));

          setChatMessages((prev) => ({
            ...prev,
            [selectedChat]: formattedMsgs,
          }));
          setMessageCursors((prev) => ({ ...prev, [selectedChat]: result.nextCursor ?? null }));
        } else if (res.status === 403) {
          setSelectedChat(null);
          notify({ kind: "error", text: "You no longer have access to this conversation." });
        } else {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Unable to load messages");
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        notify({ kind: "error", text: error instanceof Error ? error.message : "Unable to load messages" });
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [getStoredPrivateKey, notify, selectedChat, userId]);

  const loadOlderMessages = useCallback(async () => {
    if (!selectedChat || selectedChat === "team" || !userId || loadingOlderMessages) return;
    const cursor = messageCursors[selectedChat];
    if (!cursor) return;

    setLoadingOlderMessages(true);
    loadingOlderRef.current = true;
    try {
      const res = await fetch(
        `/api/messages?conversationId=${encodeURIComponent(selectedChat)}&userId=${encodeURIComponent(userId)}&limit=50&cursor=${encodeURIComponent(cursor)}`
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load older messages");
      const privateKey = getStoredPrivateKey();
      const olderMessages: Message[] = await Promise.all((result.messages ?? []).map(async (m: {
        id: string;
        content: string;
        sender?: { username?: string };
        createdAt: string;
        senderId: string;
      }) => {
        let content = m.content;
        if (privateKey) {
          const decrypted = await decryptMessagePayload(
            content,
            privateKey,
            `conversation:${selectedChat}:sender:${m.senderId}`
          );
          if (decrypted) content = decrypted;
          else if (content.startsWith('{"version":"v2"')) content = "[Unable to decrypt message]";
        }
        return {
          id: m.id,
          content,
          sender: m.sender?.username || "Unknown",
          timestamp: new Date(m.createdAt),
          isOwn: m.senderId === userId,
        };
      }));
      setChatMessages((prev) => ({
        ...prev,
        [selectedChat]: [...olderMessages, ...(prev[selectedChat] ?? [])],
      }));
      setMessageCursors((prev) => ({ ...prev, [selectedChat]: result.nextCursor ?? null }));
    } catch (error) {
      notify({ kind: "error", text: error instanceof Error ? error.message : "Unable to load older messages" });
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlderMessages(false);
    }
  }, [getStoredPrivateKey, loadingOlderMessages, messageCursors, notify, selectedChat, userId]);

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
      const lastMsg = conv.messages[0]; 
      let lastMessage = lastMsg?.content || "No messages yet";
      if (lastMessage.startsWith('{"version":"v1"') || lastMessage.startsWith('{"version":"v2"')) {
        lastMessage = "Encrypted message";
      }
      
      return {
        id: conv.id,
        name: friendName,
        lastMessage,
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

  // Restore state from localStorage on mount (SECURITY: Tied to userId)
  useEffect(() => {
    if (!userId) return; 
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;
      
      const parsed = JSON.parse(raw) as {
        userId: string;
        selectedChat: string | null;
      };
      
      // SECURITY CHECK: Only restore state if it belongs to the current user
      if (parsed.userId !== userId) {
        localStorage.removeItem(STORAGE_KEY); // Wipe stale data from previous user
        return;
      }

      setSelectedChat(parsed.selectedChat);
    } catch { 
      localStorage.removeItem(STORAGE_KEY); // Clear corrupted storage
    }
  }, [userId]);

  // Save state to localStorage on change
  useEffect(() => {
    if (!userId) return;
    try {
      const payload = {
        userId, // Tie storage to the specific user
        selectedChat,
        chats: chats.map((c) => ({ ...c, timestamp: c.timestamp.toISOString() })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch { /* ignore */ }
  }, [selectedChat, chats, chatMessages, userId]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    if (!loadingOlderRef.current) scrollToBottom();
  }, [selectedChat, currentMessages.length]);
  useEffect(() => { if (selectedChat) messageInputRef.current?.focus(); }, [selectedChat]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || !selectedChat || !userId || sending) return;

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

    setSending(true);
    try {
      const selectedConversation = conversations.find((conversation) => conversation.id === selectedChat);
      const recipient = selectedConversation?.participants.find((participant) => participant.id !== userId);
      const recipientPublicKey = recipient?.publicKey;
      const senderPublicKey = getStoredPublicKey();

      if (!recipientPublicKey) {
        throw new Error("This chat is missing the recipient encryption key.");
      }

      const savedMessage = await sendMessage(
        selectedChat,
        trimmed,
        userId,
        recipientPublicKey,
        senderPublicKey ?? undefined
      );

      const newMsg: Message = {
        id: savedMessage.id,
        content: trimmed,
        sender: loggedInUser,
        timestamp: new Date(savedMessage.createdAt),
        isOwn: true,
      };

      setChatMessages((prev) => ({
        ...prev,
        [selectedChat]: [...(prev[selectedChat] ?? []), newMsg],
      }));

      relayLiveMessage({
        conversationId: selectedChat,
        messageId: savedMessage.id,
      }).catch((error) => {
        console.error("Realtime delivery failed; message remains available in history:", error);
      });

      setMessage("");
      requestAnimationFrame(scrollToBottom);
    } catch (error) {
      console.error(error);
      notify({ kind: "error", text: error instanceof Error ? error.message : "Failed to send message" });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      console.error(error);
      notify({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong" });
    }
  };

  if (keyUnavailable) {
    return (
      <main className="flex h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <h1 className="mb-3 text-2xl font-semibold">Unlock your encryption key</h1>
        <p className="mb-6 max-w-md text-sm text-gray-400">
          Your private key is kept only in this browser session and is no longer available.
          Log in again to unlock it. Your account remains safe, but encrypted messages cannot
          be opened until the key is restored.
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded bg-green-400 px-4 py-2 font-medium text-black hover:bg-green-500"
        >
          Return to login
        </button>
      </main>
    );
  }

  return (
    <div className="relative flex h-screen flex-col bg-black text-white md:flex-row">
      <ChatSidebar
        chats={chats}
        friends={friends}
        requests={requests}
        selectedChat={selectedChat}
        loggedInUser={loggedInUser}
        userId={userId ?? ""}
        search={search}
        loading={loadingData}
        onSearchChange={setSearch}
        onSelectChat={setSelectedChat}
        onSendFriendRequest={(username) => runAction(() => sendFriendRequest(username))}
        onAcceptRequest={(requestId) => runAction(() => acceptFriendRequest(requestId))}
        onDeclineRequest={(requestId) => runAction(() => declineFriendRequest(requestId))}
        onCancelRequest={(requestId) => runAction(() => cancelFriendRequest(requestId))}
        onRemoveFriend={(friendId, chatId) => runAction(() => removeFriend(friendId, chatId))}
        onLogout={handleLogout}
        formatTime={formatTime}
      />
      <ConversationView
        selectedChat={selectedChat}
        chats={chats}
        messages={currentMessages}
        message={message}
        loadingMessages={loadingMessages}
        loadingOlderMessages={loadingOlderMessages}
        hasOlderMessages={Boolean(selectedChat && messageCursors[selectedChat])}
        sending={sending}
        showEmoji={showEmoji}
        messageInputRef={messageInputRef}
        messagesEndRef={messagesEndRef}
        onMessageChange={setMessage}
        onKeyDown={handleKeyDown}
        onSend={() => void handleSend()}
        onLoadOlder={() => void loadOlderMessages()}
        onToggleEmoji={() => setShowEmoji((visible) => !visible)}
        onAddEmoji={(emoji) => {
          setMessage((current) => current + emoji);
          setShowEmoji(false);
        }}
        formatTime={formatTime}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
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

  if (loggedInUser === null) return null;

  return <ChatShell />;
}
