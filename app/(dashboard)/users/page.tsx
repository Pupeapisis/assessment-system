'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'assessor' })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at')
    setUsers(data || [])
  }

  useEffect(() => { fetchUsers() }, [])

  const handleAdd = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: form.email,
        password: form.password,
        email_confirm: true,
      })
      if (error) throw error
      await supabase.from('users').insert({
        id: data.user.id,
        name: form.name,
        email: form.email,
        role: form.role,
      })
      toast.success('เพิ่มผู้ใช้สำเร็จ')
      setShowModal(false)
      setForm({ name: '', email: '', password: '', role: 'assessor' })
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบผู้ใช้นี้?')) return
    await supabase.from('users').delete().eq('id', id)
    toast.success('ลบผู้ใช้สำเร็จ')
    fetchUsers()
  }

  const roleLabel: Record<string, string> = {
    admin: 'ผู้ดูแลระบบ',
    assessor: 'ผู้ประเมิน',
    viewer: 'ผู้ดูรายงาน',
  }

  const roleColor: Record<string, string> = {
    admin: 'bg-purple-50 text-purple-700',
    assessor: 'bg-blue-50 text-blue-700',
    viewer: 'bg-gray-100 text-gray-600',
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">ผู้ใช้ทั้งหมด {users.length} คน</span>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          + เพิ่มผู้ใช้
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-sm font-medium text-blue-600">
                {u.name?.[0] || '?'}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{u.name}</div>
                <div className="text-xs text-gray-400">{u.email}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-1 rounded-full ${roleColor[u.role]}`}>
                {roleLabel[u.role]}
              </span>
              <button
                onClick={() => handleDelete(u.id)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                ลบ
              </button>
            </div>
          </div>
        ))}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-sm font-medium text-gray-900 mb-4">เพิ่มผู้ใช้ใหม่</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">รหัสผ่าน</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">บทบาท</label>
                <select
                  value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                >
                  <option value="admin">ผู้ดูแลระบบ</option>
                  <option value="assessor">ผู้ประเมิน</option>
                  <option value="viewer">ผู้ดูรายงาน</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAdd}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
