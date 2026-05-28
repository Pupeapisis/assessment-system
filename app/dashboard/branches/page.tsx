'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function BranchesPage() {
  const [branches, setBranches] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '' })
  const supabase = createClient()

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*').order('created_at')
    setBranches(data || [])
  }

  useEffect(() => { fetchBranches() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '' })
    setShowModal(true)
  }

  const openEdit = (b: any) => {
    setEditing(b)
    setForm({ name: b.name })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('กรุณาระบุชื่อสาขา'); return }
    if (editing) {
      const { error } = await supabase.from('branches').update(form).eq('id', editing.id)
      if (error) { toast.error('เกิดข้อผิดพลาด'); return }
      toast.success('แก้ไขสาขาสำเร็จ')
    } else {
      const { error } = await supabase.from('branches').insert({ ...form, active: true })
      if (error) { toast.error('เกิดข้อผิดพลาด'); return }
      toast.success('เพิ่มสาขาสำเร็จ')
    }
    setShowModal(false)
    fetchBranches()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบสาขานี้?')) return
    const { error } = await supabase.from('branches').delete().eq('id', id)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('ลบสาขาสำเร็จ')
    fetchBranches()
  }

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from('branches').update({ active: !active }).eq('id', id)
    fetchBranches()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">สาขาทั้งหมด {branches.length} สาขา</span>
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          + เพิ่มสาขา
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-3 gap-4 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-100">
          <div>ชื่อสาขา</div>
          <div>สถานะ</div>
          <div>จัดการ</div>
        </div>
        {branches.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">ยังไม่มีสาขา</div>
        ) : (
          branches.map(b => (
            <div key={b.id} className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50">
              <div className="text-sm font-medium text-gray-900">{b.name}</div>
              <div>
                <button
                  onClick={() => handleToggle(b.id, b.active)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${b.active ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${b.active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(b)} className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">แก้ไข</button>
                <button onClick={() => handleDelete(b.id)} className="text-xs px-2 py-1 border border-red-100 text-red-500 rounded-lg hover:bg-red-50">ลบ</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-sm font-medium text-gray-900 mb-4">
              {editing ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'}
            </h2>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่อสาขา</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ name: e.target.value })}
                placeholder="เช่น BKK, CNX, HKT"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600">ยกเลิก</button>
              <button onClick={handleSave} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
