// lib/utils/printPdf.ts
//
// สั่งพิมพ์ PDF จากปุ่มในหน้าเว็บ — ยกมาจาก aoocommerce lib/print-pdf.ts (วิธีที่บิล AOO ใช้ · เจ้าของ 30 ต.ค. 69)
//   คอม:    โหลด PDF ใส่ iframe ที่ซ่อนไว้ แล้วเปิดหน้าต่างพิมพ์ของเบราว์เซอร์ทันที (ไม่ต้องเปิดแท็บใหม่)
//   มือถือ: iframe.print() ใช้ไม่ได้ → เปิดแท็บเปล่า "ก่อน await" (ไม่งั้น iOS บล็อก popup) แล้วค่อยใส่ PDF
//           iOS ใช้ data URL เพราะ blob: ข้ามหน้าเปิดไม่ขึ้นใน Safari
//
// ใช้: onClick={() => printWithPreOpen(() => fetchPdf(url), 'ฉลาก สคบ.')}

export function isMobilePrint(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
  return iOS || /Android/i.test(ua)
}

const isIOS = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document)
}

/** blank tab opened synchronously inside the click handler — mobile only (desktop prints from a hidden iframe) */
export function preOpenPrintWindow(): Window | null {
  if (typeof window === 'undefined' || !isMobilePrint()) return null
  try {
    const w = window.open('', '_blank')
    w?.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>กำลังเตรียมเอกสาร...</title>
<style>html,body{height:100%;margin:0;font-family:system-ui,sans-serif;background:#f3f4f6}
.box{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#374151}</style>
</head><body><div class="box">กำลังเตรียมเอกสาร...</div></body></html>`)
    return w
  } catch {
    return null
  }
}

let currentIframe: HTMLIFrameElement | null = null
let currentUrl: string | null = null

function cleanup() {
  currentIframe?.remove()
  currentIframe = null
  if (currentUrl) URL.revokeObjectURL(currentUrl)
  currentUrl = null
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

/** desktop: hidden iframe + print dialog · mobile: show the PDF in the pre-opened tab */
export function showPdfPreview(blob: Blob, title = 'PDF', preopened?: Window | null) {
  if (isMobilePrint()) {
    const win = preopened ?? window.open('', '_blank')
    const renderInto = (w: Window, src: string) => {
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title.replace(/[<>"']/g, '')}</title><style>html,body{margin:0;height:100%;background:#525659}
.pdf{position:fixed;inset:0;width:100%;height:100%;border:none}</style></head><body><iframe class="pdf" src="${src}"></iframe></body></html>`
      try {
        w.document.open()
        w.document.write(html)
        w.document.close()
      } catch {
        w.location.href = src
      }
    }
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
    if (!win) window.location.href = url
    else if (isIOS()) blobToDataUrl(blob).then((d) => renderInto(win, d)).catch(() => win.document.write('โหลด PDF ไม่สำเร็จ'))
    else renderInto(win, url)
    return
  }

  cleanup()
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
  currentUrl = url
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;'
  iframe.src = url
  document.body.appendChild(iframe)
  currentIframe = iframe
  iframe.onload = () => {
    try {
      iframe.contentWindow?.print()
    } catch {
      window.open(url, '_blank')
    }
    setTimeout(cleanup, 60_000)
  }
}

/** open the mobile tab first (synchronously), then produce the PDF and print/show it */
export function printWithPreOpen(produceBlob: () => Promise<Blob>, title = 'PDF'): Promise<void> {
  const win = preOpenPrintWindow()
  return produceBlob()
    .then((blob) => showPdfPreview(blob, title, win))
    .catch((err) => {
      win?.close()
      throw err
    })
}

/** GET a PDF; a JSON error body becomes the thrown message */
export async function fetchPdf(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.blob()
}
