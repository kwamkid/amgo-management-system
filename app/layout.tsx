// app/layout.tsx
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import './globals.css'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans-thai',
  display: 'swap',
})

export const metadata = {
  title: 'AMGO Management System',
  description: 'ระบบบริหารจัดการพนักงาน AMGO',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={ibmPlexSansThai.variable}>
      <body 
        className={ibmPlexSansThai.className}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}