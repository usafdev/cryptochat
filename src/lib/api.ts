export async function sendMessage(
  conversationId: string,
  content: string,
  senderId: string
) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversationId,
      content,
      senderId,
    }),
  });

  if (!response.ok) {
    // Extract the actual error message from the backend for better debugging
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to send message");
  }

  return response.json();
}