import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, friendId } = body;

    if (!userId || !friendId) {
      return NextResponse.json(
        { error: "Missing userId or friendId" },
        { status: 400 }
      );
    }

    if (userId === friendId) {
      return NextResponse.json(
        { error: "Cannot remove yourself" },
        { status: 400 }
      );
    }

    // Find the accepted friend request between these two users
    // (It could be that the current user was the sender OR the receiver)
    const existingFriendship = await prisma.friendRequest.findFirst({
      where: {
        status: "accepted",
        OR: [
          {
            senderId: userId,
            receiverId: friendId,
          },
          {
            senderId: friendId,
            receiverId: userId,
          },
        ],
      },
    });

    if (!existingFriendship) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 404 }
      );
    }

    // Delete the friendship record
    await prisma.friendRequest.delete({
      where: {
        id: existingFriendship.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Friend removed successfully",
    });

  } catch (error) {
    console.error("Remove friend error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}