/**
 * ไอคอนเว็บ (favicon) จากบริการของ Google — แบบเดียวกับที่ Search Console ใช้
 * ไม่ต้องเก็บไฟล์เอง · เว็บที่ไม่มี favicon Google คืนรูปโลกสีเทามาแทน
 *
 * <SiteFavicon domain="adayfresh.com" size={20} />
 * สไตล์อยู่ที่ .aoo-favicon ใน globals.css
 */
export default function SiteFavicon({ domain, size = 20 }: { domain: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- รูปเล็กจากโดเมนภายนอก ไม่ต้องผ่าน next/image
    <img
      className="aoo-favicon"
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      width={size}
      height={size}
      alt=""
      loading="lazy"
    />
  )
}
