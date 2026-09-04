// lib/utils/resizeImage.ts
//
// ย่อรูปก่อนอัปโหลด — กล้องมือถือให้มา 12–48 ล้านพิกเซล (3–8 MB ต่อรูป)
// รูปสต็อก/หน้าร้านถ่ายวันละหลายรูป × 11 คน × ทุกวัน เก็บเต็มขนาดไม่ไหว
// (เจ้าของสั่ง 4 ก.ย. 69: "ย่อรูปด้วย จะได้ไม่เปลืองที่")
//
// ด้านยาวสุด 1600px + JPEG 0.82 ≈ 200–350 KB — ยังซูมดูของบนชั้นได้ชัด
// ทำบนเครื่องผู้ใช้ก่อนส่ง จึงประหยัดทั้งที่เก็บและเน็ตตอนอัปโหลด

export async function resizeImage(
  source: Blob,
  opts: { maxSide?: number; quality?: number } = {}
): Promise<Blob> {
  const maxSide = opts.maxSide ?? 1600
  const quality = opts.quality ?? 0.82

  const bitmap = await createImageBitmap(source)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))

  // เล็กอยู่แล้ว — ไม่ต้องแตะ (ย่อซ้ำมีแต่เสียคุณภาพ)
  if (scale === 1 && source.type === 'image/jpeg') {
    bitmap.close()
    return source
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('ย่อรูปไม่สำเร็จ'))),
      'image/jpeg',
      quality
    )
  })
}
