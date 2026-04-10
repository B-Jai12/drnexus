import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard"]

// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ["/auth/login", "/auth/register", "/auth/forgot-password"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for Firebase session cookie (set after login)
  const session = request.cookies.get("firebase-session")?.value

  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  )
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  // If trying to access dashboard without session -> redirect to login
  if (isProtected && !session) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If already logged in and hitting auth pages -> redirect to dashboard
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/dashboard/overview", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
  ],
}
