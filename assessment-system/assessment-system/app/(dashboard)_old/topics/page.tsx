'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function TopicsPage() {
  const [topics, setTopics] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ title: '', description: '', category_id: '' })
  const supabase = createClient()

  const fetchTopics = async () => {
    const { data } = await supabase
      .from('assessment_topics')
      .select('*, category:assessment_categories(name)')
      .order('sort_order')
    setTopics(data || [])
  }

  const fetchCategories = async () => {
    const { data } = await supabase.from('assessment_categories').select('*')
    setCategories(data || [])
  }

  useEffect(() => {
    fetchTopics()
    fetchCategories()
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ title: '', description: '', category_id: categories[0]?.id || '' })
    setShowModal(true)
  }

  const openEdit = (t: any) => {
    setEditing(t)
    setForm({ title: t.title, description: t.description || '', category_id: t.category_id })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('กรุณาระบุชื่อหัวข้อ'); return }
    if (editing) {
      const { error } = await supabase.from('assessment_topics').update(form).eq('id', editing.id)
      if (error) { toast.error('เกิดข้อผิดพลาด'); return }
      toast.success('แก้ไขหัวข้อสำเร็จ')
    } else {
      const { error } = await supabase.from('assessment_topics').insert({ ...form, active: true })
      if (error) { toast.error('เกิดข้อผิดพลาด'); return }
      toast.success('เพิ่มหัวข้อสำเร็จ')
    }
    setShowModal(false)
    fetchTopics()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบหัวข้อนี้?')) return
    const { error } = await supabase.from('assessment_topics').delete().eq('id', id)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('ลบหัวข้อสำเร็จ')
    fetchTopics()
  }

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from('assessment_topics').update({ active: !active }).eq('id', id)
    fetchTopics()
  }

  const filtered = topics.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาหัวข้อ..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          + เพิ่มหัวข้อ
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-100">
          <div className="col-span-2">หัวข้อ</div>
          <div>สถานะ</div>
          <div>จัดการ</div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">ไม่พบหัวข้อ</div>
        ) : (
          filtered.map(t => (
            <div key={t.id} className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50">
              <div className="col-span-2">
                <div className="text-sm font-medium text-gray-900">{t.title}</div>
                <div className="text-xs text-gray-400">{t.category?.name}</div>
              </div>
              <div>
                <button
                  onClick={() => handleToggle(t.id, t.active)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${t.active ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${t.active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(t)} className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">แก้ไข</button>
                <button onClick={() => handleDelete(t.id)} className="text-xs px-2 py-1 border border-red-100 text-red-500 rounded-lg hover:bg-red-50">ลบ</button>
              </div>
            </div>
          ))
        )}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-sm font-medium text-gray-900 mb-4">
              {editing ? 'แก้ไขหัวข้อ' : 'เพิ่มหัวข้อใหม่'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ชื่อหัวข้อ</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">หมวดหมู่</label>
                <select
                  value={form.category_id}
                  onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">รายละเอียด</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
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
