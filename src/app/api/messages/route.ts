import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";


// GET messages for a conversation
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing conversationId" },
        { status: 400 }
      );
    }


    const messages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      include: {
        sender: {
          select: {
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

    const {
      content,
      senderId,
      conversationId,
    } = await req.json();


    if (!content || !senderId || !conversationId) {

      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );

    }


    const message = await prisma.message.create({

      data: {
        content,
        senderId,
        conversationId,
      },

      include: {
        sender: {
          select: {
            username: true,
          },
        },
      },

    });


    return NextResponse.json(message);


  } catch(error) {

    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status:500 }
    );

  }

}