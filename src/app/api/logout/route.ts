import { clearSessionCookie, getSessionUser, revokeSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  await revokeSession(await getSessionUser());
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
