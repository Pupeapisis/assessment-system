'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { label: 'แดชบอร์ด', href: '/dashboard', icon: '📊' },
  { label: 'สร้างแบบประเมิน', href: '/dashboard/assessment', icon: '📝' },
  { label: 'จัดการหัวข้อ', href: '/dashboard/topics', icon: '📋' },
  { label: 'รายงาน', href: '/dashboard/report', icon: '📄' },
  { label: 'จัดการผู้ใช้', href: '/dashboard/users', icon: '👥' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm">✓</div>
            <div>
              <p className="text-xs font-medium text-gray-900">ระบบประเมิน</p>
              <p className="text-xs text-gray-400">Enterprise Suite</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors
                  ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            🚪 ออกจากระบบ
          </button>
        </div>
      </aside>
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-5 gap-3 sticky top-0 z-10">
          <span className="flex-1 text-sm font-medium text-gray-900">
            {navItems.find(n => n.href === pathname)?.label || 'ระบบประเมิน'}
          </span>
          <Link
            href="/dashboard/assessment"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
          >
            + สร้างประเมินใหม่
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
