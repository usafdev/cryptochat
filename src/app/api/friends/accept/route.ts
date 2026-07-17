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
      where: {
        id: requestId,
      },
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

    const request = await prisma.friendRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status: "accepted",
      },
    });

    return NextResponse.json(request);

  } catch(error) {
    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}