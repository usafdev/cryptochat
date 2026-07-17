import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { senderId, receiverId } = body;

    if (!senderId || !receiverId) {
      return NextResponse.json(
        { error: "Missing user IDs" },
        { status: 400 }
      );
    }

    if (senderId === receiverId) {
      return NextResponse.json(
        { error: "Cannot send request to yourself" },
        { status: 400 }
      );
    }

    const sender = await prisma.user.findUnique({
        where: {
            id: senderId,
        },
        });

        if (!sender) {
        return NextResponse.json(
            { error: "Sender not found" },
            { status: 404 }
        );
        }

    const receiver = await prisma.user.findUnique({
        where: {
            id: receiverId,
        },
        });

        if (!receiver) {
        return NextResponse.json(
            { error: "Receiver not found" },
            { status: 404 }
        );
        }

    const existingRequest = await prisma.friendRequest.findFirst({
        where: {
            status: "pending",
            OR: [
            {
                senderId,
                receiverId,
            },
            {
                senderId: receiverId,
                receiverId: senderId,
            },
            ],
        },
        });

    if (existingRequest) {
      return NextResponse.json(
        { error: "Friend request already exists" },
        { status: 400 }
      );
    }

    const request = await prisma.friendRequest.create({
      data: {
        senderId,
        receiverId,
      },
    });

    return NextResponse.json(request);

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

