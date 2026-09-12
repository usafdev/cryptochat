-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "FriendRequest_receiverId_status_createdAt_idx" ON "FriendRequest"("receiverId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FriendRequest_senderId_status_createdAt_idx" ON "FriendRequest"("senderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FriendRequest_senderId_receiverId_status_idx" ON "FriendRequest"("senderId", "receiverId", "status");
