import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // ssh2 (ใช้สั่ง WP-CLI บนโฮสต์ลูกค้า) มี native binding ที่ bundler ยัดเข้า
  // ESM chunk ไม่ได้ — ต้องปล่อยให้ require ตอนรันแทน
  serverExternalPackages: ['ssh2'],

  // ไฟล์ฟอนต์ Sarabun ถูกอ่านด้วย fs ตอนรัน (เอาไปฝังในไฟล์ Word) ไม่ได้
  // import เป็นโมดูล — ตัวไล่หาไฟล์ของ Next จึงมองไม่เห็นและไม่ส่งขึ้น Vercel
  // ผลคือบนเครื่องทำงานปกติ แต่บน production ฝังฟอนต์ไม่ได้แบบเงียบ ๆ
  outputFileTracingIncludes: {
    '/api/documents/[id]/docx': ['./lib/documents/fonts/**'],
  },

  // ── โดเมนเดียว = คุกกี้ใบเดียว (เจ้าของยืนยัน 22 ส.ค.) ──────────────
  // คุกกี้ session แยกตามโดเมน และ LINE callback ส่งกลับมาที่
  // NEXT_PUBLIC_APP_URL เสมอ · คนที่เปิดจากลิงก์เก่า (amgo-management.vercel.app)
  // จึงล็อกอินแล้วคุกกี้ไปตกที่ app.amgovenger.com — กลับมาเปิดลิงก์เดิมก็เจอ
  // หน้าล็อกอินอีก ดูเหมือน "session หมดอายุ" ทั้งที่ล็อกอินสำเร็จไปแล้ว
  //
  // ใช้ 307 (permanent: false) ไม่ใช่ 308 — เบราว์เซอร์ไม่แคชถาวร ถ้าวันหนึ่ง
  // ต้องเปิดโดเมนนั้นตรง ๆ อีกก็แค่ถอดกฎนี้ออก ไม่ต้องไล่ล้างแคชของทุกเครื่อง
  //
  // preview deployment ใช้โฮสต์คนละชื่อ (amgo-management-git-...) จึงไม่โดน
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'amgo-management.vercel.app' }],
        destination: 'https://app.amgovenger.com/:path*',
        permanent: false,
      },
    ]
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;