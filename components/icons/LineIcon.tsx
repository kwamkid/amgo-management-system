// โลโก้ LINE (บับเบิลคำพูดมีคำว่า LINE) — ใช้บนปุ่มเข้าสู่ระบบ
//
// วาดเองเพราะไม่มีไลบรารีไอคอนในโปรเจกต์ และไฟล์ที่มีอยู่ (line_oa.svg ของ aoocommerce)
// เป็นตรา LINE Official Account (โล่ตัว L) ไม่ใช่โลโก้ LINE
//
// สีเริ่มต้น: บับเบิลขาว ตัวอักษรเขียว LINE (#06C755) — สำหรับวางบนปุ่มพื้นเขียว
// อยากได้แบบเขียวบนพื้นขาว ส่ง bubble="#06C755" text="#fff"
export function LineIcon({
  size = 24,
  bubble = '#ffffff',
  text = '#06C755',
  className,
}: {
  size?: number
  bubble?: string
  text?: string
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* บับเบิล: กรอบมนกว้าง + หางเล็กมุมล่างซ้าย (ทรงเดียวกับโลโก้ LINE) */}
      <path
        d="M24 7C13.5 7 5 13.9 5 22.4c0 7.6 6.6 13.9 15.6 15.1.6.1.9.4.9.9 0 .5-.3 2.4-.4 3.1-.1.6.3 1 .9.7 1.4-.6 7.9-4.7 10.9-8.1 2.9-1.7 6-4.8 8.7-8.3 1-1.5 1.4-2.9 1.4-3.4C43 13.9 34.5 7 24 7z"
        fill={bubble}
      />
      <text
        x="24"
        y="23.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="12.5"
        letterSpacing="0.3"
        fill={text}
      >
        LINE
      </text>
    </svg>
  )
}
