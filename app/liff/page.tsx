'use client'

// หน้า LIFF — เปิดอยู่ในแอป LINE (https://liff.line.me/<LIFF_ID> → endpoint /liff)
//
// แอป LINE รู้อยู่แล้วว่าเป็นใคร จึงไม่มีหน้า login ของ LINE เลย (เพิ่ม 28 ต.ค. 69:
// iPhone ของอ๋อมแอ๋มผ่านหน้า login ของ LINE ไม่ได้ทุกทาง) · มาได้ 2 ทาง:
//
// 1. เปิดจากเมนู LINE OA / ไอคอนบนหน้าจอที่ LIFF สร้าง → แลก session ในแอป LINE แล้วใช้งานในนั้นเลย
// 2. ปุ่ม LINE ในหน้า /login บนมือถือ เปิดมาพร้อม `?nonce=` → server ฝาก session ไว้ตาม nonce
//    หน้า /login ที่ยังเปิดอยู่ (แอปที่ติดตั้ง/Safari/Chrome) มาหยิบเอง · หน้านี้แค่บอกให้กลับไป
import { useEffect, useState } from 'react'
import { Button, Card, Spinner } from '@/components/aoo'
import { signInBoth } from '@/lib/auth/dual-session'
import { LIFF_ID } from '@/lib/auth/liff'
import { NONCE_RE } from '@/lib/auth/pwaState'
import type { Liff } from '@line/liff'

const ERROR_TEXT: Record<string, string> = {
  account_deleted: 'บัญชีนี้ถูกลบออกจากระบบแล้ว',
  account_ended: 'บัญชีนี้พ้นสภาพพนักงานแล้ว',
  account_inactive: 'บัญชียังไม่ได้รับอนุมัติ — ติดต่อ HR',
}
/** เคยกด "ไม่ต้อง" ที่ชวนสร้างไอคอนแล้ว — ไม่ถามซ้ำ */
const SHORTCUT_KEY = 'amgo_liff_shortcut_dismissed'

type Stage =
  | { kind: 'loading' }
  | { kind: 'handed_off' }
  | { kind: 'shortcut'; next: string }
  | { kind: 'error'; message: string }

/** nonce อยู่ใน query ตรง ๆ หรือซ่อนใน liff.state (ก่อน init LINE ห่อ query ไว้ในนั้น) */
function readNonce(): string | null {
  const params = new URLSearchParams(window.location.search)
  const direct = params.get('nonce')
  if (direct && NONCE_RE.test(direct)) return direct
  const state = params.get('liff.state')
  if (!state) return null
  const inner = new URLSearchParams(state.slice(state.indexOf('?') + 1)).get('nonce')
  return inner && NONCE_RE.test(inner) ? inner : null
}

function safeNext(next: string | null | undefined) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
}

export default function LiffPage() {
  const [stage, setStage] = useState<Stage>({ kind: 'loading' })
  const [liff, setLiff] = useState<Liff | null>(null)

  useEffect(() => {
    // อ่านก่อน init — init อาจเขียน URL ใหม่
    const nonce = readNonce()
    ;(async () => {
      try {
        const { default: sdk } = await import('@line/liff')
        await sdk.init({ liffId: LIFF_ID })
        setLiff(sdk)
        // เปิดนอกแอป LINE (เช่นบนคอม) — ต้องผ่านหน้า login ของ LINE ตามปกติ
        if (!sdk.isLoggedIn()) {
          sdk.login({ redirectUri: window.location.href })
          return
        }

        const res = await fetch('/api/auth/liff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: sdk.getAccessToken(), nonce }),
        })
        const data = await res.json().catch(() => ({}))

        if (data.register) return window.location.replace(data.register)
        if (data.handedOff) return setStage({ kind: 'handed_off' })
        if (!data.tokenHash) {
          return setStage({ kind: 'error', message: ERROR_TEXT[data.error] ?? 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่' })
        }

        await signInBoth({ tokenHash: data.tokenHash })
        const next = safeNext(data.next)

        let dismissed = false
        try {
          dismissed = localStorage.getItem(SHORTCUT_KEY) === '1'
        } catch { /* โหมดส่วนตัว */ }
        if (sdk.isInClient() && sdk.isApiAvailable('createShortcutOnHomeScreen') && !dismissed && next === '/dashboard') {
          return setStage({ kind: 'shortcut', next })
        }
        window.location.replace(next)
      } catch (err) {
        console.error('[liff]', err)
        setStage({ kind: 'error', message: 'เปิดระบบผ่าน LINE ไม่สำเร็จ กรุณาลองใหม่' })
      }
    })()
  }, [])

  const addShortcut = async (next: string) => {
    try {
      await liff?.createShortcutOnHomeScreen({ url: `https://liff.line.me/${LIFF_ID}` })
    } catch (err) {
      console.error('[liff] สร้างไอคอนไม่สำเร็จ', err)
    }
    window.location.replace(next)
  }

  const skipShortcut = (next: string) => {
    try {
      localStorage.setItem(SHORTCUT_KEY, '1')
    } catch { /* โหมดส่วนตัว */ }
    window.location.replace(next)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm p-6 text-center">
        {stage.kind === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Spinner size="lg" />
            <p className="text-base text-gray-600">กำลังเข้าสู่ระบบผ่าน LINE…</p>
          </div>
        )}

        {stage.kind === 'handed_off' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-lg font-semibold text-gray-900">ยืนยันตัวตนแล้ว ✓</p>
            <p className="text-base leading-7 text-gray-600">
              กลับไปที่แอป AMGO (หรือเบราว์เซอร์) ที่กดเข้าสู่ระบบไว้ได้เลย ระบบจะเข้าให้เอง
            </p>
            <Button variant="secondary" onClick={() => liff?.closeWindow()}>
              ปิดหน้านี้
            </Button>
          </div>
        )}

        {stage.kind === 'shortcut' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-lg font-semibold text-gray-900">เพิ่มไอคอน AMGO บนหน้าจอไหม?</p>
            <p className="text-base leading-7 text-gray-600">
              กดไอคอนแล้วเปิดระบบผ่าน LINE ได้ทันที ไม่ต้องเข้าสู่ระบบอีก
            </p>
            <div className="flex w-full flex-col gap-2">
              <Button onClick={() => addShortcut(stage.next)}>เพิ่มไอคอน</Button>
              <Button variant="ghost" onClick={() => skipShortcut(stage.next)}>
                ไม่ต้อง
              </Button>
            </div>
          </div>
        )}

        {stage.kind === 'error' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-base leading-7 text-gray-700">{stage.message}</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              ลองใหม่
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
