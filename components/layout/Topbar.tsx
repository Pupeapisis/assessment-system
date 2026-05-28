'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const titles: Record<string, string> = {
  '/': 'แดชบอร์ด',
  '/assessment': 'สร้างแบบประเมิน',
  '/topics': 'จัดการหัวข้อ',
  '/report': 'รายงาน',
  '/users': 'จัดการผู้ใช้',
}

export default function Topbar() {
  const pathname = usePathname()

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-5 gap-3 sticky top-0 z-10">
      <span className="flex-1 text-sm font-medium text-gray-900">
        {titles[pathname] || 'ระบบประเมิน'}
      </span>
      <Link
        href="/assessment"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
      >
        + สร้างประเมินใหม่
      </Link>
    </header>
  )
}
