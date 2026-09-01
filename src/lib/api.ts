import { encryptMessagePayload } from "@/lib/crypto";

export async function sendMessage(
  conversationId: string,
  content: string,
  senderId: string,
  recipientPublicKey: string
) {
  if (!recipientPublicKey) {
    throw new Error("Encryption key missing for this recipient");
  }

  const encryptedPayload = await encryptMessagePayload(content, recipientPublicKey);

  const response = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversationId,
      content: JSON.stringify(encryptedPayload),
      senderId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to send message");
  }

  return response.json();
}