import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Auth pages redirect directly to dashboard since auth is disabled
const AUTH_ROUTES = ["/auth/login", "/auth/register", "/auth/forgot-password"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  // If hitting auth pages -> direct to dashboard
  if (isAuthRoute) {
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
