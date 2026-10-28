import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  generateAdminToken,
  isAdmin,
  isValidPassword,
  isValidToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request) {
  let password = "";
  let token = "";

  try {
    const body = (await request.json()) as { password?: string; token?: string };
    password = String(body.password ?? "").trim();
    token = String(body.token ?? "").trim();
  } catch {
    password = "";
    token = "";
  }

  const authenticated = isValidPassword(password) || isValidToken(token);

  if (!authenticated) {
    return NextResponse.json(
      {
        ok: false,
        error: "Incorrect access key.",
      },
      { status: 401 },
    );
  }

  const adminToken = generateAdminToken();
  const response = NextResponse.json({
    ok: true,
    admin: true,
    token: adminToken,
    message: "Admin authenticated successfully.",
  });

  // Secure cookies are required inside cross-site iframes (SameSite=None), but
  // browsers drop them on plain http://localhost, so fall back to Lax in dev.
  const isHttps =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  try {
    response.cookies.set({
      name: ADMIN_COOKIE,
      value: adminToken,
      httpOnly: false, // allow client-side hydration check as fallback
      sameSite: isHttps ? "none" : "lax",
      secure: isHttps,
      path: "/",
      maxAge: MAX_AGE,
    });
  } catch {
    // fallback
  }

  return response;
}

export async function GET(request: Request) {
  const authed = await isAdmin(request);
  const token = authed ? generateAdminToken() : null;
  return NextResponse.json({
    ok: authed,
    admin: authed,
    token,
  });
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true, message: "Logged out." });
  const isHttps =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: "",
    httpOnly: false,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    path: "/",
    maxAge: 0,
  });
  return response;
}
