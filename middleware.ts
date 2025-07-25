// middleware.ts (แบบ Simple)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // แค่ redirect หน้าแรกไป login
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: '/',
}