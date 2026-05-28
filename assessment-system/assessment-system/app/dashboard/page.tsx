'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    assessments: 0,
    topics: 0,
    reports: 0,
    users: 0,
  })
  const [recent, setRecent] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    const fetchStats = async () => {
      const [a, t, r, u] = await Promise.all([
        supabase.from('assessments').select('*', { count: 'exact', head: true }),
        supabase.from('assessment_topics').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
      ])
      setStats({
        assessments: a.count || 0,
        topics: t.count || 0,
        reports: r.count || 0,
        users: u.count || 0,
      })
    }
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('assessments')
        .select('*, user:users(name)')
        .order('created_at', { ascending: false })
        .limit(5)
      setRecent(data || [])
    }
    fetchStats()
    fetchRecent()
  }, [])

  const statusLabel: Record<string, string> = {
    draft: 'ร่าง',
    submitted: 'ส่งแล้ว',
    reviewed: 'ตรวจแล้ว',
  }
  const statusColor: Record<string, string> = {
    draft: 'bg-yellow-50 text-yellow-700',
    submitted: 'bg-blue-50 text-blue-700',
    reviewed: 'bg-green-50 text-green-700',
  }
  const cards = [
    { label: 'การประเมินทั้งหมด', value: stats.assessments, icon: '📋' },
    { label: 'หัวข้อที่ใช้งาน', value: stats.topics, icon: '📌' },
    { label: 'รายงานที่ออกแล้ว', value: stats.reports, icon: '📄' },
    { label: 'ผู้ใช้งาน', value: stats.users, icon: '👥' },
  ]

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{c.label}</span>
              <span className="text-xl">{c.icon}</span>
            </div>
            <div className="text-2xl font-medium text-gray-900">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h2 className="text-sm font-medium text-gray-900 mb-4">รายการประเมินล่าสุด</h2>
        {recent.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">ยังไม่มีรายการประเมิน</div>
        ) : (
          <div className="space-y-2">
            {recent.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-50 hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs text-blue-600 font-medium">
                  {item.branch_name?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-900">{item.branch_name}</div>
                  <div className="text-xs text-gray-400">{item.user?.name || '-'}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${statusColor[item.status]}`}>
                  {statusLabel[item.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
