import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId1, userId2 } = await req.json();

    if (!userId1 || !userId2) {
      return NextResponse.json(
        { error: "Missing users" },
        { status: 400 }
      );
    }


    // Check if DM already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          {
            participants: {
              some: {
                id: userId1,
              },
            },
          },
          {
            participants: {
              some: {
                id: userId2,
              },
            },
          },
        ],
      },
      include: {
        participants: {
          select: {
            id: true,
            username: true,
            publicKey: true,
          },
        },
      },
    });


    if (existingConversation) {
      return NextResponse.json(existingConversation);
    }


    // Create new DM
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [
            { id: userId1 },
            { id: userId2 },
          ],
        },
      },
      include: {
        participants: {
          select: {
            id: true,
            username: true,
            publicKey: true,
          },
        },
      },
    });


    return NextResponse.json(conversation);


  } catch(error) {

    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status:500 }
    );

  }
}