import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "cryptochat_session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-session-secret-please-change";
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not configured; using a development fallback. Set it before production deployment.");
}
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

export type SessionUser = {
  userId: string;
  username: string;
  exp: number;
};

function toBase64Url(value: string | Uint8Array | Buffer): string {
  const bytes = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function signToken(payload: SessionUser): string {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${header}.${body}.${signature}`;
}

export function createSessionCookie(userId: string, username: string) {
  const payload: SessionUser = {
    userId,
    username,
    exp: Date.now() + SESSION_TTL_MS,
  };

  return {
    name: SESSION_COOKIE_NAME,
    value: signToken(payload),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const expectedSignature = createHmac("sha256", SESSION_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const decoded = JSON.parse(fromBase64Url(payload).toString("utf8")) as SessionUser;

    if (!decoded.userId || !decoded.username || decoded.exp < Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
}

export function isAuthorizedUser(userId: string | null, sessionUser: SessionUser | null) {
  return Boolean(userId && sessionUser && sessionUser.userId === userId);
}
