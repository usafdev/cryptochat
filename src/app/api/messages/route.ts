import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { NextResponse } from "next/server";

// GET messages for a conversation
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const userId = searchParams.get("userId");
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

    const messages = await prisma.message.findMany({
      where: {
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
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(messages);
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

    if (!sessionUser || sessionUser.userId !== senderId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
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