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
  icons: {
    icon: '/amgo-logo.svg',
    shortcut: '/amgo-logo.svg',
    apple: '/amgo-logo.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={ibmPlexSansThai.variable} suppressHydrationWarning>
      <body className={ibmPlexSansThai.className} suppressHydrationWarning>
        <LoadingProvider>
          {children}
        </LoadingProvider>
      </body>
    </html>
  )
}