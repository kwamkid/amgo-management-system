'use client'

// หน้า "ติดตั้ง AMGO เป็นแอป" — ขั้นตอนแยก iOS / Android เลือกให้ตามเครื่องที่เปิด
//
// ทำไมต้องมีหน้านี้ทั้งที่มีแถบชวนแล้ว: iOS ไม่มี prompt ของระบบ ผู้ใช้ต้องกดเองหลายขั้น
// และพนักงานส่วนใหญ่เปิดลิงก์จาก LINE ซึ่งเป็นเบราว์เซอร์ฝังที่ไม่มีเมนูติดตั้งเลย —
// ขั้นแรกจึงเป็น "เปิดใน Safari/Chrome ก่อน" ซึ่งต้องอธิบาย · HR ส่งลิงก์หน้านี้ให้
// พนักงานใหม่ได้ทีเดียวจบ
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Smartphone, Share, SquarePlus, Ellipsis, EllipsisVertical, Download, BellRing,
  CircleCheck, Copy, Check, Zap, ScanFace,
} from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { TabBar, TabItem } from '@/components/aoo'
import { isIos, isAndroid, isStandalone, inAppBrowser } from '@/lib/push/client'
import { useInstallPrompt } from '@/lib/push/installPrompt'

type Os = 'ios' | 'android'

function Step({ n, icon, children }: { n: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-sm leading-6 text-gray-800">{children}</div>
      {icon && <span className="shrink-0 pt-1 text-gray-400">{icon}</span>}
    </li>
  )
}

const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-gray-900">{children}</b>

export default function InstallPage() {
  const [os, setOs] = useState<Os>('ios')
  const [standalone, setStandalone] = useState(false)
  const [embedded, setEmbedded] = useState<'line' | 'facebook' | null>(null)
  const [origin, setOrigin] = useState('app.amgovenger.com')
  const [copied, setCopied] = useState(false)
  const { canPrompt, prompt } = useInstallPrompt()

  useEffect(() => {
    if (isAndroid()) setOs('android')
    else if (isIos()) setOs('ios')
    setStandalone(isStandalone())
    setEmbedded(inAppBrowser())
    setOrigin(window.location.host)
  }, [])

  const shareUrl = `https://${origin}/install`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* เบราว์เซอร์ไม่ให้คัดลอก — ผู้ใช้เลือกข้อความเองได้ */ }
  }

  return (
    <>
      <PageHeader
        title="ติดตั้ง AMGO เป็นแอป"
        description="เปิดจากไอคอนบนหน้าจอโฮม ไม่ต้องหาลิงก์ · แจ้งเตือนเด้งถึงเครื่อง"
        icon={Smartphone}
      />

      <div className="mx-auto max-w-2xl space-y-4">
        {standalone && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <CircleCheck size={20} className="mt-0.5 shrink-0 text-green-600" />
            <div className="text-sm text-green-900">
              <p className="font-semibold">เครื่องนี้เปิดจากแอปอยู่แล้ว</p>
              <p className="mt-0.5">
                เหลือแค่เปิดแจ้งเตือน —{' '}
                <Link href="/profile" className="font-medium underline underline-offset-2">
                  ไปที่โปรไฟล์ → แอปบนอุปกรณ์นี้
                </Link>
              </p>
            </div>
          </div>
        )}

        {!standalone && embedded && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Ellipsis size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">
                ตอนนี้เปิดอยู่ใน {embedded === 'line' ? 'LINE' : 'Facebook'} — ติดตั้งจากตรงนี้ไม่ได้
              </p>
              <p className="mt-0.5">
                กดเมนู {os === 'ios' ? '⋯ มุมขวาล่าง' : '⋮ มุมขวาบน'} แล้วเลือก{' '}
                <B>{os === 'ios' ? '"เปิดใน Safari"' : '"เปิดในเบราว์เซอร์" (Chrome)'}</B> แล้วทำตามขั้นตอนด้านล่างในนั้น
              </p>
            </div>
          </div>
        )}

        {/* ทำไมต้องติดตั้ง */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-4">
            <Image src="/icons/icon-192.png" alt="ไอคอนแอป AMGO" width={64} height={64} className="h-16 w-16 rounded-2xl shadow-sm" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-gray-900">ได้อะไรจากการติดตั้ง</p>
              <ul className="mt-1 space-y-0.5">
                <li className="flex items-center gap-2"><Zap size={14} className="text-gray-400" /> เปิดจากไอคอนได้ทันที เต็มจอ ไม่มีแถบเบราว์เซอร์</li>
                <li className="flex items-center gap-2"><BellRing size={14} className="text-gray-400" /> ใบลา/ใบสลับวันหยุด แจ้งเตือนเด้งถึงเครื่อง</li>
                <li className="flex items-center gap-2"><ScanFace size={14} className="text-gray-400" /> กล้องเช็คอิน/ถ่ายรูปสต็อกใช้ได้เต็มจอ</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ขั้นตอน */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <TabBar ariaLabel="เลือกระบบปฏิบัติการ" className="mb-2">
            <TabItem active={os === 'ios'} onClick={() => setOs('ios')} label="iPhone / iPad" />
            <TabItem active={os === 'android'} onClick={() => setOs('android')} label="Android" />
          </TabBar>

          {os === 'ios' ? (
            <ol className="divide-y divide-gray-100">
              <Step n={1}>
                เปิดหน้านี้ใน <B>Safari</B> — ถ้าเปิดจาก LINE ให้กด ⋯ มุมขวาล่าง แล้วเลือก "เปิดใน Safari" ก่อน
              </Step>
              <Step n={2} icon={<Share size={18} />}>
                กดปุ่ม <B>แชร์</B> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ที่แถบล่างของ Safari
              </Step>
              <Step n={3} icon={<SquarePlus size={18} />}>
                เลื่อนรายการลงมา แล้วกด <B>"เพิ่มไปยังหน้าจอโฮม"</B> (Add to Home Screen)
              </Step>
              <Step n={4}>
                กด <B>"เพิ่ม"</B> มุมขวาบน — ไอคอน AMGO จะไปอยู่บนหน้าจอโฮม
              </Step>
              <Step n={5} icon={<Smartphone size={18} />}>
                <B>เปิดจากไอคอน AMGO</B> แล้วล็อกอิน LINE อีกครั้ง (แอปกับ Safari แยกกัน ต้องล็อกอินใหม่ 1 ครั้ง)
              </Step>
              <Step n={6} icon={<BellRing size={18} />}>
                ไปที่ <B>โปรไฟล์ → แอปบนอุปกรณ์นี้</B> เปิดสวิตช์แจ้งเตือน แล้วกด "ส่งทดสอบ"
              </Step>
            </ol>
          ) : (
            <ol className="divide-y divide-gray-100">
              <Step n={1}>
                เปิดหน้านี้ใน <B>Chrome</B> — ถ้าเปิดจาก LINE ให้กด ⋮ มุมขวาบน แล้วเลือก "เปิดในเบราว์เซอร์" ก่อน
              </Step>
              <Step n={2} icon={<Download size={18} />}>
                {canPrompt ? (
                  <>
                    กดปุ่มนี้แล้วยืนยัน <B>"ติดตั้ง"</B>
                    <div className="mt-2">
                      <button
                        onClick={prompt}
                        className="flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700"
                      >
                        <Download size={14} /> ติดตั้งแอป AMGO
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    กด <EllipsisVertical size={14} className="inline -mt-0.5" /> มุมขวาบนของ Chrome แล้วเลือก{' '}
                    <B>"ติดตั้งแอป"</B> หรือ <B>"เพิ่มไปยังหน้าจอหลัก"</B>
                  </>
                )}
              </Step>
              <Step n={3}>
                กด <B>"ติดตั้ง"</B> ยืนยัน — ไอคอน AMGO จะไปอยู่บนหน้าจอหลัก
              </Step>
              <Step n={4} icon={<Smartphone size={18} />}>
                <B>เปิดจากไอคอน AMGO</B> — ล็อกอินค้างอยู่แล้วเข้าได้เลย
              </Step>
              <Step n={5} icon={<BellRing size={18} />}>
                ไปที่ <B>โปรไฟล์ → แอปบนอุปกรณ์นี้</B> เปิดสวิตช์แจ้งเตือน แล้วกด "ส่งทดสอบ"
              </Step>
            </ol>
          )}

          <p className="mt-3 text-xs text-gray-500">
            {os === 'ios'
              ? 'แจ้งเตือนบน iPhone ต้องใช้ iOS 16.4 ขึ้นไป และเด้งเฉพาะเมื่อเปิดจากไอคอนแอป (จาก Safari ไม่เด้ง)'
              : 'ถ้าไม่เห็นเมนู "ติดตั้งแอป" ลองอัปเดต Chrome หรือเปิดหน้านี้ใหม่อีกครั้ง'}
          </p>
        </div>

        {/* สำหรับ HR/ผู้จัดการ ส่งต่อ */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900">ส่งให้พนักงานคนอื่น</p>
          <p className="mt-0.5 text-xs text-gray-500">ส่งลิงก์นี้ใน LINE — เปิดแล้วจะเห็นขั้นตอนของเครื่องตัวเอง</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800">
              {shareUrl}
            </code>
            <button
              onClick={copy}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
