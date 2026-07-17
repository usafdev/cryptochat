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

    const requests = await prisma.friendRequest.findMany({
      where: {
        senderId: userId,
        status: "pending",
      },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json(requests);

  } catch(error) {
    console.error(error);

    return NextResponse.json(
      { error:"Server error" },
      { status:500 }
    );
  }
}