"use client";

import { Button } from "../../components/ui/Button";
import { Lock, Search, Settings } from "lucide-react";
import type { Chat, Friend, FriendRequest } from "../types";

type Props = {
  chats: Chat[];
  friends: Friend[];
  requests: FriendRequest[];
  selectedChat: string | null;
  loggedInUser: string;
  userId: string;
  search: string;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onSendFriendRequest: (username: string) => Promise<void>;
  onAcceptRequest: (requestId: string) => Promise<void>;
  onDeclineRequest: (requestId: string) => Promise<void>;
  onCancelRequest: (requestId: string) => Promise<void>;
  onRemoveFriend: (friendId: string, chatId: string) => Promise<void>;
  onLogout: () => Promise<void>;
  formatTime: (date: Date) => string;
};

export function ChatSidebar({
  chats,
  friends,
  requests,
  selectedChat,
  loggedInUser,
  userId,
  search,
  loading,
  onSearchChange,
  onSelectChat,
  onSendFriendRequest,
  onAcceptRequest,
  onDeclineRequest,
  onCancelRequest,
  onRemoveFriend,
  onLogout,
  formatTime,
}: Props) {
  const incoming = requests.filter((request) => request.status === "pending" && request.receiverId === userId);
  const outgoing = requests.filter((request) => request.status === "pending" && request.senderId === userId);
  const visibleChats = chats.filter((chat) => {
    if (chat.id === "team") return true;
    return chat.name.toLowerCase().includes(search.toLowerCase());
  });

  async function submitFriendRequest(input: HTMLInputElement) {
    const username = input.value.trim();
    if (!username) return;
    await onSendFriendRequest(username);
    input.value = "";
  }

  return (
    <aside className="flex w-full flex-col border-b border-gray-800 md:w-80 md:border-b-0 md:border-r">
      <div className="border-b border-gray-800 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-bold" aria-label="App title">
            <Lock className="h-5 w-5 text-green-400" />
            CryptoChat
          </h1>
          <Button variant="ghost" size="icon" aria-label="Settings are not available yet" title="Settings coming soon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search chats..."
            aria-label="Search chats"
            className="w-full rounded-lg border border-gray-800 bg-gray-900 py-2 pl-10 pr-4 text-sm focus:border-green-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="max-h-[42vh] flex-1 space-y-4 overflow-y-auto p-2 md:max-h-none">
        <section className="border-b border-gray-800 pb-3">
          <h2 className="mb-2 text-sm font-semibold text-green-400">Send Request</h2>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="username"
              aria-label="Friend username"
              disabled={loading}
              className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs focus:border-green-400 focus:outline-none"
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitFriendRequest(event.currentTarget);
              }}
            />
            <Button variant="ghost" size="sm" className="text-xs" disabled={loading} onClick={(event) => {
              const input = event.currentTarget.previousElementSibling;
              if (input instanceof HTMLInputElement) void submitFriendRequest(input);
            }}>
              Send
            </Button>
          </div>
        </section>

        <section className="border-b border-gray-800 pb-3">
          <h2 className="mb-2 text-sm font-semibold text-green-400">Incoming</h2>
          {incoming.length === 0 ? (
            <p className="text-xs text-gray-500">No pending requests</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {incoming.map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-2 rounded px-1 hover:bg-gray-800">
                  <span className="truncate">{request.sender?.username} wants to be friends</span>
                  <span className="flex shrink-0 gap-2">
                    <button className="text-green-400" onClick={() => void onAcceptRequest(request.id)} aria-label={`Accept ${request.sender?.username}`}>✓</button>
                    <button className="text-red-400" onClick={() => void onDeclineRequest(request.id)} aria-label={`Decline ${request.sender?.username}`}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-green-400">Conversations</h2>
          {friends.length === 0 && <p className="text-xs text-gray-500">No friends yet</p>}
          {visibleChats.filter((chat) => chat.id !== "team").map((chat) => {
            const friend = friends.find((item) => item.username === chat.name);
            return (
              <div key={chat.id} className={`group flex cursor-pointer items-center justify-between rounded p-2 hover:bg-gray-900 ${selectedChat === chat.id ? "bg-gray-900" : ""}`} onClick={() => onSelectChat(chat.id)}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium">{chat.name}</span>
                    <span className="text-xs text-gray-500">{formatTime(chat.timestamp)}</span>
                  </div>
                  <p className="truncate text-xs text-gray-400">{chat.lastMessage}</p>
                </div>
                {friend && (
                  <button
                    title={`Remove ${chat.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (window.confirm(`Remove ${chat.name} from friends?`)) void onRemoveFriend(friend.id, chat.id);
                    }}
                    className="ml-2 hidden text-xs text-red-400 hover:text-red-300 group-hover:block"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </section>

        <section className="border-t border-gray-800 pt-3">
          <h2 className="mb-2 text-sm font-semibold text-green-400">Outgoing</h2>
          {outgoing.length === 0 ? (
            <p className="text-xs text-gray-500">None</p>
          ) : outgoing.map((request) => (
            <div key={request.id} className="flex items-center justify-between rounded px-1 text-xs hover:bg-gray-800">
              <span>→ {request.receiver?.username || "Unknown"}</span>
              <button className="text-red-400" onClick={() => void onCancelRequest(request.id)} aria-label={`Cancel request to ${request.receiver?.username}`}>✕</button>
            </div>
          ))}
        </section>
      </div>

      <div className="flex items-center gap-3 border-t border-gray-800 bg-gray-900/50 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-400 text-sm font-bold text-black">
          {loggedInUser.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{loggedInUser}</p>
          <p className="flex items-center gap-1.5 text-xs text-green-400"><span className="h-1.5 w-1.5 rounded-full bg-green-400" />Online</p>
        </div>
        <button onClick={() => void onLogout()} className="shrink-0 rounded border border-gray-700 px-3 py-1 text-sm text-gray-300 transition-colors hover:bg-red-500 hover:text-white" aria-label="Logout">
          Logout
        </button>
      </div>
    </aside>
  );
}
