import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { requestId } = body;
    const sessionUser = await getSessionUser();

    if (!requestId) {
      return NextResponse.json(
        { error: "Missing requestId" },
        { status: 400 }
      );
    }

    const request = await prisma.friendRequest.findUnique({
      where: {
        id: requestId,
      },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    if (!sessionUser || request.receiverId !== sessionUser.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (request.status !== "pending") {
      return NextResponse.json(
        { error: "Request is no longer pending" },
        { status: 400 }
      );
    }

    await prisma.friendRequest.delete({
      where: {
        id: requestId,
      },
    });

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}