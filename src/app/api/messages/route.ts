import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isValidEncryptedMessagePayload } from "@/lib/validation";

// GET messages for a conversation
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const userId = searchParams.get("userId");
    const cursor = searchParams.get("cursor");
    const requestedLimit = Number(searchParams.get("limit") || "50");
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
      : 50;
    const sessionUser = await getSessionUser();

    if (!conversationId || !userId) {
      return NextResponse.json(
        { error: "Missing conversationId or userId" },
        { status: 400 }
      );
    }

    if (!sessionUser || sessionUser.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // SECURITY: Verify the user is a participant in this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            id: userId,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Unauthorized or conversation not found" },
        { status: 403 }
      );
    }

    let cursorFilter = {};
    if (cursor) {
      const separator = cursor.indexOf("|");
      if (separator <= 0) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }
      const createdAt = new Date(cursor.slice(0, separator));
      const id = cursor.slice(separator + 1);
      if (Number.isNaN(createdAt.getTime()) || !id) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }
      cursorFilter = {
        OR: [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lt: id } },
        ],
      };
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...cursorFilter,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit).reverse();
    const oldest = page[0];
    const nextCursor = hasMore && oldest
      ? `${oldest.createdAt.toISOString()}|${oldest.id}`
      : null;

    return NextResponse.json({ messages: page, nextCursor });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

// POST create message
export async function POST(req: Request) {
  try {
    const { content, senderId, conversationId } = await req.json();
    const sessionUser = await getSessionUser();

    if (!content || !senderId || !conversationId) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    if (
      !isValidEncryptedMessagePayload(
        content,
        `conversation:${conversationId}:sender:${senderId}`
      )
    ) {
      return NextResponse.json(
        { error: "Message must contain a valid encrypted payload" },
        { status: 400 }
      );
    }

    if (!sessionUser || sessionUser.userId !== senderId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const rateLimitResponse = enforceRateLimit(req, {
      name: "message-create",
      limit: 60,
      windowMs: 60 * 1000,
      key: sessionUser.userId,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // SECURITY: Verify sender is actually in the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            id: senderId,
          },
        },
      },
      include: {
        participants: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Find the other participant in the conversation
    const recipient = conversation.participants.find(
      (participant) => participant.id !== senderId
    );

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 400 }
      );
    }

    // SECURITY: Make sure the sender and recipient are STILL friends
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        status: "accepted",
        OR: [
          {
            senderId: senderId,
            receiverId: recipient.id,
          },
          {
            senderId: recipient.id,
            receiverId: senderId,
          },
        ],
      },
    });

    // If they removed each other, the friendship record no longer exists
    if (!friendship) {
      return NextResponse.json(
        { error: "You can only message your friends." },
        { status: 403 }
      );
    }

    // Only create the message if they are still friends
    const message = await prisma.message.create({
      data: {
        content: String(content),
        encrypted: true,
        senderId,
        conversationId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}