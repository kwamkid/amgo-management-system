// app/layout.tsx
import type { Metadata } from 'next'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import { LoadingProvider } from '@/lib/contexts/LoadingContext'
import './globals.css'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans-thai',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'AMGO Management System',
    template: '%s | AMGO'
  },
  description: 'ระบบบริหารจัดการพนักงาน AMGO',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={ibmPlexSansThai.variable}>
      <body className={ibmPlexSansThai.className}>
        <LoadingProvider>
          {children}
        </LoadingProvider>
      </body>
    </html>
  )
}