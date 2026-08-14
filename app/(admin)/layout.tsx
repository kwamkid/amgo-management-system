// app/(admin)/layout.tsx
//
// โครงหน้าหลังบ้าน — เมนูข้างตรึงซ้าย 232px + แถบบน 56px
// จอแคบกว่า 1024px เมนูข้างกลายเป็นลิ้นชัก เลื่อนออกมาทับพร้อมฉากหลังทึบ

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ToastProvider } from "@/components/aoo";
import { Toaster } from "react-hot-toast";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userData, realRole } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // เปลี่ยนหน้าแล้วปิดลิ้นชักเสมอ ไม่งั้นค้างทับหน้าใหม่
  useEffect(() => setDrawerOpen(false), [pathname]);

  // กัน body เลื่อนตอนลิ้นชักเปิดอยู่
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  // Esc ปิดลิ้นชัก
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <ProtectedRoute>
      {/* react-hot-toast ยังอยู่เพราะหน้าเก่าเรียกใช้อยู่หลายจุด
          ของใหม่ใช้ ToastProvider ของ aoo — ค่อยยุบเหลือตัวเดียวทีหลัง */}
      <ToastProvider>
        <div className="flex min-h-screen bg-gray-50">
          {/* เมนูข้าง — เดสก์ท็อป */}
          <div className="sticky top-0 hidden h-screen lg:block">
            <Sidebar userData={userData} />
          </div>

          {/* เมนูข้าง — ลิ้นชักบนมือถือ */}
          {drawerOpen && (
            <>
              <div
                className="fixed inset-0 z-40 lg:hidden"
                style={{ background: "rgba(26, 20, 17, 0.45)" }}
                onClick={() => setDrawerOpen(false)}
                aria-hidden
              />
              <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
                <Sidebar
                  userData={userData}
                  onNavigate={() => setDrawerOpen(false)}
                />
              </div>
            </>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <Navbar
              userData={userData}
              realRole={realRole}
              onMenuClick={() => setDrawerOpen(true)}
            />

            {/* ชิดซ้ายเต็มความกว้าง ไม่บีบกลางจอ — หน้าหลังบ้านเป็นตารางหลายคอลัมน์
                ถ้าตรึง max-width ไว้ ตารางจะโดนบีบทั้งที่จอยังเหลือที่ว่างอีกเยอะ */}
            <main className="w-full min-w-0 flex-1 px-4 pb-10 pt-5 lg:px-7">
              {children}
            </main>
          </div>

          <Toaster
            toastOptions={{
              style: {
                background: "var(--bg-surface)",
                color: "var(--fg-1)",
                border: "1px solid var(--border-2)",
                borderRadius: "var(--r-md)",
                fontSize: 14,
                boxShadow: "var(--shadow-lg)",
              },
            }}
          />
        </div>
      </ToastProvider>
    </ProtectedRoute>
  );
}
