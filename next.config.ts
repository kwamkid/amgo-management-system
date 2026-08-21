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