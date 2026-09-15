/** Browser error names are stable; don't mistake every camera failure for denied permission. */
export function cameraFailureMessage(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'เบราว์เซอร์ไม่อนุญาตให้ใช้กล้อง กรุณาตรวจสอบสิทธิ์กล้องตามขั้นตอนด้านล่าง'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'เปิดกล้องไม่ได้ กล้องอาจถูกแอปอื่นใช้อยู่ กรุณาปิดแอปที่ใช้กล้อง แล้วลองอีกครั้ง'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'ไม่พบกล้องที่ใช้งานได้ กรุณาตรวจสอบกล้องของเครื่อง หรือลองเปิดในเบราว์เซอร์หลัก'
    case 'OverconstrainedError':
      return 'กล้องไม่รองรับการตั้งค่านี้ กรุณาลองเปิดในเบราว์เซอร์หลัก'
    default:
      return 'เปิดกล้องไม่สำเร็จ กรุณาลองอีกครั้ง หรือเปิดหน้าเช็คอินในเบราว์เซอร์หลัก'
  }
}

/** Open only the check-in page, without carrying auth tokens or arbitrary query strings. */
export function chromeCheckinIntent(origin: string): string {
  const url = new URL('/checkin', origin)
  if (url.protocol !== 'https:') return url.href
  return `intent://${url.host}/checkin#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`
}
