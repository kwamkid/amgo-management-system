'use client'

// หน้า "ติดตั้ง AMGO เป็นแอป" — ขั้นตอนแยก iPhone / Android เลือกให้ตามเครื่องที่เปิด
//
// ทำเป็น "ดูรูปแล้วกดตาม" (เจ้าของขอ 5 ก.ย. 69 หลังส่งให้กลุ่มพนักงานแล้วมีคนตอบ
// "ไม่มีรายการนี้"): ทุกขั้นมีไอคอนของจริง (Safari · Chrome · LINE · ปุ่มแชร์ · ⋮)
// และหน้าจอจำลองที่วงส้มตรงที่ต้องกด · ตัวหนังสือใหญ่ ประโยคสั้น
//
// ขั้นแรกของทั้งสองระบบคือ "ออกจาก LINE ก่อน" — พนักงานส่วนใหญ่เปิดลิงก์จากกลุ่ม LINE
// ซึ่งเป็นเบราว์เซอร์ฝังที่ไม่มีเมนูติดตั้งเลย นี่คือเหตุผลหลักของ "ไม่มีรายการนี้"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Smartphone, BellRing, CircleCheck, Copy, Check, Download, HelpCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { isIos, isAndroid, isStandalone, inAppBrowser } from '@/lib/push/client'
import { useInstallPrompt } from '@/lib/push/installPrompt'
import {
  SafariIcon, ChromeIcon, LineAppIcon, ShareIosIcon, AddToHomeIcon, KebabIcon, EllipsisIcon, ThenArrow,
} from '@/components/install/GuideIcons'
import {
  SafariBottomBarMock, IosShareSheetMock, IosAddBarMock, HomeScreenMock,
  ChromeTopBarMock, ChromeMenuMock, AndroidInstallDialogMock,
} from '@/components/install/GuideMocks'

type Os = 'ios' | 'android'

/** หนึ่งขั้น: เลขใหญ่ · ไอคอนของสิ่งที่ต้องกด · ประโยคสั้น · หน้าจอจำลอง (ถ้ามี) */
function Step({
  n, icon, title, hint, children,
}: {
  n: number
  icon?: React.ReactNode
  title: React.ReactNode
  hint?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-lg font-bold text-white">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-7 text-gray-900">{title}</p>
          {hint && <p className="mt-0.5 text-base leading-6 text-gray-600">{hint}</p>}
        </div>
        {icon && <span className="shrink-0">{icon}</span>}
      </div>
      {children && <div className="mt-3">{children}</div>}
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
    // ?os=android / ?os=ios — HR ส่งลิงก์เจาะจงเครื่องได้ (และไว้ถ่ายภาพหน้าตรวจ)
    const forced = new URLSearchParams(window.location.search).get('os')
    if (forced === 'android' || forced === 'ios') setOs(forced)
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

  const leaveLine = (
    <span className="mt-2 inline-flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
      <LineAppIcon size={28} />
      <span className="text-sm text-gray-700">กด</span>
      <EllipsisIcon size={22} />
      <ThenArrow />
      {os === 'ios' ? <SafariIcon size={28} /> : <ChromeIcon size={28} />}
      <span className="text-sm text-gray-700">{os === 'ios' ? 'เปิดใน Safari' : 'เปิดในเบราว์เซอร์'}</span>
    </span>
  )

  return (
    <>
      <PageHeader
        title="ติดตั้ง AMGO เป็นแอป"
        description="ทำตามทีละขั้น 2 นาทีเสร็จ — เปิดจากไอคอนได้เลย แจ้งเตือนเด้งถึงเครื่อง"
        icon={Smartphone}
      />

      <div className="mx-auto max-w-2xl space-y-4">
        {standalone && (
          <div className="flex items-start gap-3 rounded-2xl border-2 border-green-300 bg-green-50 p-4">
            <CircleCheck size={28} className="shrink-0 text-green-600" />
            <div>
              <p className="text-lg font-semibold text-green-900">เครื่องนี้ติดตั้งแล้ว เปิดจากแอปอยู่</p>
              <p className="mt-0.5 text-base text-green-900">
                เหลือแค่เปิดแจ้งเตือน —{' '}
                <Link href="/profile" className="font-semibold underline underline-offset-2">
                  ไปที่โปรไฟล์ → แอปบนอุปกรณ์นี้
                </Link>
              </p>
            </div>
          </div>
        )}

        {!standalone && embedded && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
            <p className="text-lg font-semibold text-amber-900">
              ตอนนี้เปิดอยู่ใน {embedded === 'line' ? 'LINE' : 'Facebook'} — ติดตั้งจากตรงนี้ไม่ได้
            </p>
            <p className="mt-1 text-base text-amber-900">
              กด {os === 'ios' ? '⋯ มุมขวาล่าง' : '⋮ มุมขวาบน'} แล้วเลือก{' '}
              <B>{os === 'ios' ? '"เปิดใน Safari"' : '"เปิดในเบราว์เซอร์"'}</B> ก่อน แล้วค่อยทำตามข้างล่างในนั้น
            </p>
            <div className="mt-2 flex items-center gap-2">
              <LineAppIcon size={36} />
              <EllipsisIcon size={24} />
              <ThenArrow />
              {os === 'ios' ? <SafariIcon size={36} /> : <ChromeIcon size={36} />}
            </div>
          </div>
        )}

        {/* เลือกเครื่อง — ปุ่มใหญ่มีไอคอน */}
        <div className="grid grid-cols-2 gap-2">
          {(['ios', 'android'] as Os[]).map((o) => (
            <button
              key={o}
              onClick={() => setOs(o)}
              className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-lg font-semibold ${
                os === o ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {o === 'ios' ? <SafariIcon size={30} /> : <ChromeIcon size={30} />}
              {o === 'ios' ? 'iPhone / iPad' : 'Android'}
            </button>
          ))}
        </div>

        {os === 'ios' ? (
          <ol className="space-y-3">
            <Step n={1} icon={<SafariIcon />} title={<>เปิดหน้านี้ใน <B>Safari</B></>} hint="ถ้าเปิดจาก LINE อยู่ ให้ออกไป Safari ก่อน">
              {leaveLine}
            </Step>
            <Step n={2} icon={<ShareIosIcon size={36} />} title={<>กดปุ่ม <B>แชร์</B> ที่แถบล่าง</>} hint="สี่เหลี่ยมมีลูกศรชี้ขึ้น ตรงกลางแถบล่างของ Safari">
              <SafariBottomBarMock />
            </Step>
            <Step n={3} icon={<AddToHomeIcon size={36} />} title={<>เลื่อนลง แล้วกด <B>"เพิ่มไปยังหน้าจอโฮม"</B></>} hint="อยู่ล่าง ๆ ของรายการ ต้องเลื่อนลงมาก่อน">
              <IosShareSheetMock />
            </Step>
            <Step n={4} title={<>กด <B>"เพิ่ม"</B> มุมขวาบน</>}>
              <IosAddBarMock />
            </Step>
            <Step n={5} icon={<Smartphone size={32} className="text-gray-500" />} title={<>เปิดจาก<B>ไอคอน AMGO</B>บนหน้าจอโฮม</>} hint="ต้องล็อกอิน LINE อีกครั้งในแอป (แอปกับ Safari แยกกัน ทำครั้งเดียว)">
              <HomeScreenMock />
            </Step>
            <Step n={6} icon={<BellRing size={32} className="text-amber-500" />} title={<>ในแอป: <B>โปรไฟล์ → แอปบนอุปกรณ์นี้</B> เปิดสวิตช์แจ้งเตือน</>} hint="กด “ส่งทดสอบ” ถ้าเด้ง = เสร็จ" />
          </ol>
        ) : (
          <ol className="space-y-3">
            {canPrompt ? (
              <Step n={1} icon={<Download size={32} className="text-gray-500" />} title="กดปุ่มนี้ แล้วกด “ติดตั้ง”">
                <button
                  onClick={prompt}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-lg font-semibold text-white active:scale-[0.99]"
                >
                  <Download size={22} /> ติดตั้งแอป AMGO
                </button>
                <div className="mt-3">
                  <AndroidInstallDialogMock />
                </div>
              </Step>
            ) : (
              <>
                <Step n={1} icon={<ChromeIcon />} title={<>เปิดหน้านี้ใน <B>Chrome</B></>} hint="ถ้าเปิดจาก LINE อยู่ ให้ออกไป Chrome ก่อน">
                  {leaveLine}
                </Step>
                <Step n={2} icon={<KebabIcon size={36} />} title={<>กด <B>⋮</B> มุมขวาบนของ Chrome</>}>
                  <ChromeTopBarMock />
                </Step>
                <Step n={3} title={<>กด <B>"ติดตั้งแอป"</B> หรือ <B>"เพิ่มไปยังหน้าจอหลัก"</B></>} hint="เจออันไหนก็กดอันนั้น">
                  <ChromeMenuMock />
                </Step>
                <Step n={4} title={<>กด <B>"ติดตั้ง"</B> ยืนยัน</>}>
                  <AndroidInstallDialogMock />
                </Step>
              </>
            )}
            <Step n={canPrompt ? 2 : 5} icon={<Smartphone size={32} className="text-gray-500" />} title={<>เปิดจาก<B>ไอคอน AMGO</B>บนหน้าจอหลัก</>} hint="ล็อกอินค้างอยู่แล้ว เข้าได้เลย">
              <HomeScreenMock />
            </Step>
            <Step n={canPrompt ? 3 : 6} icon={<BellRing size={32} className="text-amber-500" />} title={<>ในแอป: <B>โปรไฟล์ → แอปบนอุปกรณ์นี้</B> เปิดสวิตช์แจ้งเตือน</>} hint="กด “ส่งทดสอบ” ถ้าเด้ง = เสร็จ" />
          </ol>
        )}

        {/* ไม่เห็นเมนู? — คำตอบของ "ไม่มีรายการนี้" */}
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
          <p className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <HelpCircle size={22} className="text-gray-500" /> ไม่เห็นเมนู “{os === 'ios' ? 'เพิ่มไปยังหน้าจอโฮม' : 'ติดตั้งแอป'}”?
          </p>
          <ul className="mt-2 space-y-2 text-base leading-6 text-gray-700">
            <li className="flex gap-2">
              <span className="shrink-0">1.</span>
              <span>
                ยังเปิดอยู่ใน <B>LINE</B> — ต้องกด {os === 'ios' ? '⋯' : '⋮'} แล้ว “{os === 'ios' ? 'เปิดใน Safari' : 'เปิดในเบราว์เซอร์'}” ก่อน (ข้อ 1)
              </span>
            </li>
            {os === 'ios' ? (
              <>
                <li className="flex gap-2"><span className="shrink-0">2.</span><span>ในเมนูแชร์ ให้<B>เลื่อนรายการลง</B> — “เพิ่มไปยังหน้าจอโฮม” อยู่ล่าง ๆ ไม่ได้อยู่บนสุด</span></li>
                <li className="flex gap-2"><span className="shrink-0">3.</span><span>ใช้ Chrome บน iPhone ก็ได้ — กดแชร์ (มุมขวาบน) แล้วเลื่อนหา “เพิ่มไปยังหน้าจอโฮม” เหมือนกัน</span></li>
                <li className="flex gap-2"><span className="shrink-0">4.</span><span>iPhone ต้อง iOS 16.4 ขึ้นไป (ตั้งค่า → ทั่วไป → เกี่ยวกับ)</span></li>
              </>
            ) : (
              <>
                <li className="flex gap-2"><span className="shrink-0">2.</span><span>บางรุ่นเขียนว่า “<B>เพิ่มไปยังหน้าจอหลัก</B>” หรือ “Add to Home screen” — กดอันนั้นแทน</span></li>
                <li className="flex gap-2"><span className="shrink-0">3.</span><span>เบราว์เซอร์ Samsung: กด <B>≡</B> ด้านล่าง → “เพิ่มหน้าไปยัง” → “หน้าจอหลัก”</span></li>
                <li className="flex gap-2"><span className="shrink-0">4.</span><span>ยังไม่เจอ ลองอัปเดต Chrome ใน Play Store แล้วเปิดหน้านี้ใหม่</span></li>
              </>
            )}
          </ul>
        </div>

        {/* สำหรับ HR/ผู้จัดการ ส่งต่อ */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-base font-semibold text-gray-900">ส่งให้พนักงานคนอื่น</p>
          <p className="mt-0.5 text-sm text-gray-500">ส่งลิงก์นี้ใน LINE — เปิดแล้วจะเห็นขั้นตอนของเครื่องตัวเอง</p>
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
