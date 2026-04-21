import { NextRequest, NextResponse } from "next/server";
import { decode } from "@auth/core/jwt";

export async function proxy(request: NextRequest) {
  const secure = request.url.startsWith("https://");
  const cookieName = secure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = request.cookies.get(cookieName)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const decoded = await decode({
    token,
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
  }).catch(() => null);

  if (!decoded) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)",
  ],
};
