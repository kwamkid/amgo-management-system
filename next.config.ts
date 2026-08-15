import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // ssh2 (ใช้สั่ง WP-CLI บนโฮสต์ลูกค้า) มี native binding ที่ bundler ยัดเข้า
  // ESM chunk ไม่ได้ — ต้องปล่อยให้ require ตอนรันแทน
  serverExternalPackages: ['ssh2'],

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