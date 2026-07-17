import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();

    const { requestId, userId } = body;

    if (!requestId || !userId) {
      return NextResponse.json(
        { error: "Missing requestId or userId" },
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

    // Only the sender can cancel their outgoing request
    if (request.senderId !== userId) {
      return NextResponse.json(
        { error: "Not allowed" },
        { status: 403 }
      );
    }

    if (request.status !== "pending") {
      return NextResponse.json(
        { error: "Cannot cancel this request" },
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