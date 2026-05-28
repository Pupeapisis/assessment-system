'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function TopicsPage() {
  const [topics, setTopics] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showSubModal, setShowSubModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [editingTopic, setEditingTopic] = useState<any>(null)
  const [subItems, setSubItems] = useState<any[]>([])
  const [branchConfigs, setBranchConfigs] = useState<any[]>([])
  const [form, setForm] = useState({ title: '', description: '', category_id: '' })
  const [subForm, setSubForm] = useState({ label: '', type: 'checkbox', standard_value: '' })
  const [configForm, setConfigForm] = useState({ branch_id: '', equipment_no: '', location: '' })
  const supabase = createClient()

  const fetchAll = async () => {
    const [t, c, b] = await Promise.all([
      supabase.from('assessment_topics').select('*, category:assessment_categories(name), configs:topic_branch_config(*, branch:branches(name))').order('sort_order'),
      supabase.from('assessment_categories').select('*'),
      supabase.from('branches').select('*').eq('active', true),
    ])
    setTopics(t.data || [])
    setCategories(c.data || [])
    setBranches(b.data || [])
  }

  useEffect(() => { fetchAll() }, [])

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
      const { error } = await supabase.from('assessment_topics').insert({ ...form, active: true, sort_order: topics.length })
      if (error) { toast.error('เกิดข้อผิดพลาด'); return }
      toast.success('เพิ่มหัวข้อสำเร็จ')
    }
    setShowModal(false)
    fetchAll()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบหัวข้อนี้?')) return
    const { error } = await supabase.from('assessment_topics').delete().eq('id', id)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('ลบหัวข้อสำเร็จ')
    fetchAll()
  }

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from('assessment_topics').update({ active: !active }).eq('id', id)
    fetchAll()
  }

  const openSubItems = async (t: any) => {
    setEditingTopic(t)
    const { data } = await supabase.from('topic_sub_items').select('*').eq('topic_id', t.id).order('sort_order')
    setSubItems(data || [])
    setSubForm({ label: '', type: 'checkbox', standard_value: '' })
    setShowSubModal(true)
  }

  const handleAddSubItem = async () => {
    if (!subForm.label.trim()) { toast.error('กรุณาระบุชื่อหัวข้อย่อย'); return }
    const { error } = await supabase.from('topic_sub_items').insert({
      topic_id: editingTopic.id,
      label: subForm.label,
      type: subForm.type,
      standard_value: subForm.standard_value || null,
      sort_order: subItems.length,
    })
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('เพิ่มหัวข้อย่อยสำเร็จ')
    setSubForm({ label: '', type: 'checkbox', standard_value: '' })
    const { data } = await supabase.from('topic_sub_items').select('*').eq('topic_id', editingTopic.id).order('sort_order')
    setSubItems(data || [])
  }

  const handleDeleteSubItem = async (id: string) => {
    await supabase.from('topic_sub_items').delete().eq('id', id)
    const { data } = await supabase.from('topic_sub_items').select('*').eq('topic_id', editingTopic.id).order('sort_order')
    setSubItems(data || [])
    toast.success('ลบหัวข้อย่อยสำเร็จ')
  }

  const openConfig = async (t: any) => {
    setEditingTopic(t)
    const { data } = await supabase.from('topic_branch_config').select('*, branch:branches(name)').eq('topic_id', t.id)
    setBranchConfigs(data || [])
    setConfigForm({ branch_id: branches[0]?.id || '', equipment_no: '', location: '' })
    setShowConfigModal(true)
  }

  const handleAddConfig = async () => {
    if (!configForm.branch_id) { toast.error('กรุณาเลือกสาขา'); return }
    const { error } = await supabase.from('topic_branch_config').upsert({
      topic_id: editingTopic.id,
      branch_id: configForm.branch_id,
      equipment_no: configForm.equipment_no || null,
      location: configForm.location || null,
    }, { onConflict: 'topic_id,branch_id' })
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('บันทึก config สำเร็จ')
    setConfigForm({ branch_id: branches[0]?.id || '', equipment_no: '', location: '' })
    const { data } = await supabase.from('topic_branch_config').select('*, branch:branches(name)').eq('topic_id', editingTopic.id)
    setBranchConfigs(data || [])
    fetchAll()
  }

  const handleDeleteConfig = async (id: string) => {
    await supabase.from('topic_branch_config').delete().eq('id', id)
    const { data } = await supabase.from('topic_branch_config').select('*, branch:branches(name)').eq('topic_id', editingTopic.id)
    setBranchConfigs(data || [])
    fetchAll()
  }

  const filtered = topics.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาหัวข้อ..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          + เพิ่มหัวข้อ
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-100">
          <div className="col-span-2">หัวข้อ</div>
          <div>สาขา</div>
          <div>สถานะ</div>
          <div>จัดการ</div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">ไม่พบหัวข้อ</div>
        ) : (
          filtered.map(t => (
            <div key={t.id} className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50">
              <div className="col-span-2">
                <div className="text-sm font-medium text-gray-900">{t.title}</div>
                <div className="text-xs text-gray-400">{t.category?.name}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.configs?.length > 0 ? t.configs.map((c: any) => (
                  <span key={c.id} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{c.branch?.name}</span>
                )) : <span className="text-xs text-gray-300">ไม่มี</span>}
              </div>
              <div>
                <button onClick={() => handleToggle(t.id, t.active)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${t.active ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${t.active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => openEdit(t)} className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">แก้ไข</button>
                <button onClick={() => openConfig(t)} className="text-xs px-2 py-1 border border-blue-100 text-blue-600 rounded-lg hover:bg-blue-50">สาขา</button>
                <button onClick={() => openSubItems(t)} className="text-xs px-2 py-1 border border-green-100 text-green-600 rounded-lg hover:bg-green-50">ข้อย่อย</button>
                <button onClick={() => handleDelete(t.id)} className="text-xs px-2 py-1 border border-red-100 text-red-500 rounded-lg hover:bg-red-50">ลบ</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-sm font-medium text-gray-900 mb-4">{editing ? 'แก้ไขหัวข้อ' : 'เพิ่มหัวข้อใหม่'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ชื่อหัวข้อ</label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">หมวดหมู่</label>
                <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">รายละเอียด</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600">ยกเลิก</button>
              <button onClick={handleSave} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {showConfigModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-sm font-medium text-gray-900 mb-1">ตั้งค่าสาขา</h2>
            <p className="text-xs text-gray-400 mb-4">{editingTopic?.title}</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">สาขา</label>
                <select value={configForm.branch_id} onChange={e => setConfigForm(p => ({ ...p, branch_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">หมายเลขอุปกรณ์</label>
                <input type="text" value={configForm.equipment_no} onChange={e => setConfigForm(p => ({ ...p, equipment_no: e.target.value }))}
                  placeholder="เช่น MB245-789"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">สถานที่</label>
                <input type="text" value={configForm.location} onChange={e => setConfigForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="เช่น ห้องประชุม"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <button onClick={handleAddConfig} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">
                + เพิ่ม / อัปเดต config
              </button>
            </div>
            {branchConfigs.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="text-xs font-medium text-gray-500 mb-2">สาขาที่ตั้งค่าแล้ว</div>
                {branchConfigs.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-xs font-medium text-blue-600">{c.branch?.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{c.equipment_no}</span>
                      <span className="text-xs text-gray-400 ml-2">{c.location}</span>
                    </div>
                    <button onClick={() => handleDeleteConfig(c.id)} className="text-xs text-red-400 hover:text-red-600">ลบ</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowConfigModal(false)} className="w-full border border-gray-200 rounded-lg py-2 text-sm text-gray-600 mt-4">ปิด</button>
          </div>
        </div>
      )}

      {showSubModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-sm font-medium text-gray-900 mb-1">หัวข้อย่อย</h2>
            <p className="text-xs text-gray-400 mb-4">{editingTopic?.title}</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ประเภท</label>
                <select value={subForm.type} onChange={e => setSubForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                  <option value="checkbox">✓ Checkbox (ปกติ/ไม่ปกติ)</option>
                  <option value="measurement">📏 กรอกค่าที่วัดได้</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ชื่อหัวข้อย่อย</label>
                <input type="text" value={subForm.label} onChange={e => setSubForm(p => ({ ...p, label: e.target.value }))}
                  placeholder={subForm.type === 'checkbox' ? 'เช่น ตรวจสอบสภาพภายนอก' : 'เช่น CB'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              {subForm.type === 'measurement' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ค่ามาตรฐาน</label>
                  <input type="text" value={subForm.standard_value} onChange={e => setSubForm(p => ({ ...p, standard_value: e.target.value }))}
                    placeholder="เช่น 800AT, 220V"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              )}
              <button onClick={handleAddSubItem} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">
                + เพิ่มหัวข้อย่อย
              </button>
            </div>
            {subItems.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-2 max-h-48 overflow-y-auto">
                <div className="text-xs font-medium text-gray-500 mb-2">หัวข้อย่อยทั้งหมด ({subItems.length})</div>
                {subItems.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{s.type === 'checkbox' ? '✓' : '📏'}</span>
                      <span className="text-xs text-gray-900">{s.label}</span>
                      {s.standard_value && <span className="text-xs text-gray-400">({s.standard_value})</span>}
                    </div>
                    <button onClick={() => handleDeleteSubItem(s.id)} className="text-xs text-red-400 hover:text-red-600">ลบ</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowSubModal(false)} className="w-full border border-gray-200 rounded-lg py-2 text-sm text-gray-600 mt-4">ปิด</button>
          </div>
        </div>
      )}
    </div>
  )
}
