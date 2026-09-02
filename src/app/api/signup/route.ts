import { prisma } from "@/lib/prisma";
import { createSessionCookie } from "@/lib/session";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    const { username, email, password, publicKey, encryptedPrivateKey } = await req.json();

    if (!username || !email || !password || !publicKey || !encryptedPrivateKey) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    const normalizedUsername = String(username).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordString = String(password);
    if (typeof encryptedPrivateKey !== "string" || encryptedPrivateKey.length > 20_000) {
      return NextResponse.json(
        { error: "Invalid encrypted private key" },
        { status: 400 }
      );
    }

    if (normalizedUsername.length < 3 || normalizedUsername.length > 24) {
      return NextResponse.json(
        { error: "Username must be 3-24 characters long" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    if (passwordString.length < 12) {
      return NextResponse.json(
        { error: "Password must be at least 12 characters" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: normalizedUsername }, { email: normalizedEmail }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(passwordString, 12);

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        publicKey,
        encryptedPrivateKey,
      },
    });

    const response = NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      publicKey: user.publicKey,
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