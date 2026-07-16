import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }


    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            id: userId,
          },
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
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            content: true,
            createdAt: true,
          },
        },
      },
    });


    return NextResponse.json(conversations);


  } catch(error) {

    console.error(error);

    return NextResponse.json(
      { error:"Server error" },
      { status:500 }
    );

  }
}

export async function POST(req: Request) {

  try {

    const {
      userId
    } = await req.json();


    const conversation = await prisma.conversation.create({

      data: {

        participants: {
          connect: {
            id: userId
          }
        }

      }

    });


    return NextResponse.json(conversation);


  } catch(error) {

    console.error(error);

    return NextResponse.json(
      {
        error:"Server error"
      },
      {
        status:500
      }
    );

  }

}