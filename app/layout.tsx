import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sarabun',
})

export const metadata: Metadata = {
  title: 'ระบบประเมินและออกรายงาน',
  description: 'ระบบประเมินและออกรายงาน Enterprise',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} font-sans`}>
        <Toaster position="bottom-right" />
        {children}
      </body>
    </html>
  )
}
