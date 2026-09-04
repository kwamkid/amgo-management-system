// middleware.ts
//
// หน้าที่หลักคือ "ต่ออายุ session ของ Supabase ทุก request"
// ถ้าไม่ทำ token จะหมดอายุแล้วผู้ใช้หลุดออกจากระบบเองระหว่างใช้งาน
//
// ⚠️ ห้ามใส่ logic อื่นแทรกระหว่าง createServerClient กับ getUser()
//    เพราะ getUser() คือจุดที่สั่งให้ต่ออายุ ถ้ามีอย่างอื่นมาคั่นแล้ว return
//    ก่อน จะเกิดอาการ "ล็อกอินอยู่ดี ๆ แล้วเด้งออก" ซึ่งตามหาต้นเหตุยากมาก

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // หน้าแรก → ยังไม่ล็อกอินไป login · ล็อกอินแล้วไป dashboard
  if (path === '/') {
    return NextResponse.redirect(new URL(user ? '/dashboard' : '/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // ทุกเส้นทาง ยกเว้นไฟล์สแตติกกับรูป — เพื่อให้ session ถูกต่ออายุทั่วทั้งแอป
    // (ไอคอน/service worker/manifest ของ PWA ไม่ต้องผ่าน — เบราว์เซอร์ดึงเองโดยไม่มี session)
    '/((?!_next/static|_next/image|favicon.ico|fonts/|icons/|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
