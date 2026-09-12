"use client";

import { Button } from "../../components/ui/Button";
import { Lock, Send, Smile, User } from "lucide-react";
import type { Chat, Message } from "../types";

const EMOJIS = ["😀", "😂", "😍", "🤔", "👍", "🔥", "👀", "✅", "❤️", "🚀", "🙌", "😎", "🤗", "😢", "😡"];

type Props = {
  selectedChat: string | null;
  chats: Chat[];
  messages: Message[];
  message: string;
  loadingMessages: boolean;
  sending: boolean;
  showEmoji: boolean;
  messageInputRef: React.RefObject<HTMLInputElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onMessageChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
  onToggleEmoji: () => void;
  onAddEmoji: (emoji: string) => void;
  formatTime: (date: Date) => string;
};

export function ConversationView({
  selectedChat,
  chats,
  messages,
  message,
  loadingMessages,
  sending,
  showEmoji,
  messageInputRef,
  messagesEndRef,
  onMessageChange,
  onKeyDown,
  onSend,
  onToggleEmoji,
  onAddEmoji,
  formatTime,
}: Props) {
  if (!selectedChat) {
    return (
      <div className="flex flex-1 flex-col items-center pt-20">
        <Lock className="mb-4 h-16 w-16 text-gray-700" />
        <h2 className="mb-2 text-xl font-semibold">Welcome to CryptoChat</h2>
        <p className="text-gray-400">Select a chat to start secure messaging</p>
      </div>
    );
  }

  const selected = chats.find((chat) => chat.id === selectedChat);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-gray-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800"><User className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold">{selected?.name || "Conversation"}</h2>
            <p className="text-sm text-green-400">● Online</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Lock className="h-4 w-4 text-green-400" />
          <span className="text-sm text-gray-400">End-to-end encrypted</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4" role="log" aria-live="polite" aria-relevant="additions text">
        {loadingMessages ? (
          <p className="mt-8 text-center text-sm text-gray-500">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500">No messages yet. Say hi!</p>
        ) : (
          <div className="space-y-4">
            {messages.map((item) => (
              <div key={item.id} className={`flex ${item.isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-xs break-words rounded-lg px-4 py-2 sm:max-w-sm md:max-w-md lg:max-w-lg ${item.isOwn ? "bg-green-400 text-black" : "bg-gray-800 text-white"}`}>
                  <p className={`mb-1 text-xs ${item.isOwn ? "text-gray-800" : "text-gray-300"}`}>{item.sender}</p>
                  <p className="whitespace-pre-wrap text-sm">{item.content}</p>
                  <p className={`mt-1 text-xs ${item.isOwn ? "text-gray-700" : "text-gray-400"}`}>{formatTime(item.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-800 p-4">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <input
              ref={messageInputRef}
              type="text"
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a secure message..."
              disabled={sending}
              className="w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 pr-10 focus:border-green-400 focus:outline-none disabled:opacity-60"
            />
            <button type="button" onClick={onToggleEmoji} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white" aria-label="Open emoji palette">
              <Smile className="h-5 w-5" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-full right-0 z-20 mb-2 grid grid-cols-5 gap-1 rounded border border-gray-700 bg-gray-900 p-2">
                {EMOJIS.map((emoji) => <button key={emoji} onClick={() => onAddEmoji(emoji)} className="rounded p-1 text-xl hover:bg-gray-700">{emoji}</button>)}
              </div>
            )}
          </div>
          <Button onClick={onSend} className="bg-green-400 text-black hover:bg-green-500 disabled:opacity-50" disabled={!message.trim() || sending}>
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" aria-label="Sending message" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
