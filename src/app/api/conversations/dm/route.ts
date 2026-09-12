import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser();
    const { userId1, userId2 } = await req.json();

    if (!userId1 || !userId2) {
      return NextResponse.json(
        { error: "Missing users" },
        { status: 400 }
      );
    }

    if (!sessionUser || (sessionUser.userId !== userId1 && sessionUser.userId !== userId2)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const directKey = [userId1, userId2].sort().join(":");
    const conversation = await prisma.$transaction(async (tx) => {
      const friendship = await tx.friendRequest.findFirst({
        where: {
          status: "accepted",
          OR: [
            { senderId: userId1, receiverId: userId2 },
            { senderId: userId2, receiverId: userId1 },
          ],
        },
        select: { id: true },
      });

      if (!friendship) {
        throw new Error("NOT_FRIENDS");
      }

      const existingConversation = await tx.conversation.findFirst({
        where: {
          isGroup: false,
          OR: [{ directKey }, {
            AND: [
              { participants: { some: { id: userId1 } } },
              { participants: { some: { id: userId2 } } },
            ],
          }],
        },
        include: {
          participants: {
            select: { id: true, username: true, publicKey: true },
          },
        },
      });
      if (existingConversation && !existingConversation.directKey) {
        await tx.conversation.update({
          where: { id: existingConversation.id },
          data: { directKey },
        });
      }
      if (existingConversation) return existingConversation;

      return tx.conversation.create({
        data: {
          directKey,
          participants: { connect: [{ id: userId1 }, { id: userId2 }] },
        },
        include: {
          participants: {
            select: { id: true, username: true, publicKey: true },
          },
        },
      });
    }).catch(async (error) => {
      if (error instanceof Error && error.message === "NOT_FRIENDS") {
        throw error;
      }
      if (error?.code === "P2002") {
        return prisma.conversation.findUniqueOrThrow({
          where: { directKey },
          include: {
            participants: {
              select: { id: true, username: true, publicKey: true },
            },
          },
        });
      }
      throw error;
    });


    return NextResponse.json(conversation);


  } catch(error) {
    if (error instanceof Error && error.message === "NOT_FRIENDS") {
      return NextResponse.json(
        { error: "You can only create conversations with friends." },
        { status: 403 }
      );
    }

    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status:500 }
    );

  }
}