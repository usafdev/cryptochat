import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { error: "Missing username" },
        { status: 400 }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        username: {
          contains: username,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    return NextResponse.json(users);

  } catch(error) {
    console.error(error);

    return NextResponse.json(
      { error:"Server error" },
      { status:500 }
    );
  }
}