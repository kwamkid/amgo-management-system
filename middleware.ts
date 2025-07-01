// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths ที่ไม่ต้อง redirect
  const publicPaths = [
    '/login',
    '/register',
    '/auth',
    '/api',
    '/_next',
    '/favicon.ico',
    '/logo.svg',
    '/submit', // สำหรับ influencer submission
  ]

  // Check if path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  // ถ้าเข้าหน้าแรก (/) ให้ redirect ไป login
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ถ้าไม่ใช่ public path และไม่มี token ให้ redirect ไป login
  if (!isPublicPath) {
    const token = request.cookies.get('auth-token')
    
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

// Config บอกว่าให้ middleware ทำงานกับ path ไหนบ้าง
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}