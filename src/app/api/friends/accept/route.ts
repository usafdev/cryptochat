import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: "Missing requestId" },
        { status: 400 }
      );
    }

    const existingRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    if (existingRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Request already handled" },
        { status: 400 }
      );
    }

    // 1. Update request status
    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: "accepted" },
    });

    // 2. Ensure a conversation exists for these two users
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { id: existingRequest.senderId } } },
          { participants: { some: { id: existingRequest.receiverId } } },
        ],
      },
    });

    if (!existingConversation) {
      await prisma.conversation.create({
        data: {
          isGroup: false,
          participants: {
            connect: [
              { id: existingRequest.senderId },
              { id: existingRequest.receiverId },
            ],
          },
        },
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}