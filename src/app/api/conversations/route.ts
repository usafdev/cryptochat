import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionUser = await getSessionUser();
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    if (!sessionUser || sessionUser.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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
    const sessionUser = await getSessionUser();
    const { userId } = await req.json();

    if (!sessionUser || sessionUser.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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