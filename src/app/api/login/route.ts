import { prisma } from "@/lib/prisma";
import { createSessionCookie } from "@/lib/session";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rateLimitResponse = enforceRateLimit(req, {
    name: "login",
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    const normalizedUsername = String(username).trim();
    if (!normalizedUsername || normalizedUsername.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters long" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        username: normalizedUsername,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      publicKey: user.publicKey ?? null,
      encryptedPrivateKey: user.encryptedPrivateKey ?? null,
    });

    response.cookies.set(createSessionCookie(user.id, user.username));
    return response;
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}