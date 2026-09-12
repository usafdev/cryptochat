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

    const existingRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    if (!sessionUser || existingRequest.receiverId !== sessionUser.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (existingRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Request already handled" },
        { status: 400 }
      );
    }

    const directKey = [existingRequest.senderId, existingRequest.receiverId].sort().join(":");
    await prisma.$transaction(async (tx) => {
      const updated = await tx.friendRequest.updateMany({
        where: { id: requestId, receiverId: sessionUser.userId, status: "pending" },
        data: { status: "accepted" },
      });
      if (updated.count !== 1) {
        throw new Error("REQUEST_ALREADY_HANDLED");
      }

      const existingConversation = await tx.conversation.findFirst({
        where: {
          isGroup: false,
          OR: [{ directKey }, {
            AND: [
              { participants: { some: { id: existingRequest.senderId } } },
              { participants: { some: { id: existingRequest.receiverId } } },
            ],
          }],
        },
      });
      if (existingConversation) {
        if (!existingConversation.directKey) {
          await tx.conversation.update({
            where: { id: existingConversation.id },
            data: { directKey },
          });
        }
      } else {
        await tx.conversation.create({
          data: {
            directKey,
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
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_ALREADY_HANDLED") {
      return NextResponse.json(
        { error: "Request already handled" },
        { status: 400 }
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}