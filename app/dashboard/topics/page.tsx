'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ============================================================
// TYPES
// ============================================================
type SubItemType = 'checkbox' | 'trip' | 'equipment_detail'

interface SubItem {
  id: string
  topic_id: string
  label: string
  type: SubItemType
  sort_order: number
}

interface BranchConfig {
  id: string
  topic_id: string
  branch_id: string
  equipment_no: string | null
  location: string | null
  branch?: { name: string }
}

interface Topic {
  id: string
  title: string
  description: string | null
  active: boolean
  sort_order: number
  configs?: BranchConfig[]
}

interface Branch { id: string; name: string; active: boolean }

// ============================================================
// CONSTANTS
// ============================================================
const SUB_TYPE_LABEL: Record<SubItemType, string> = {
  checkbox: 'Checkbox (ปกติ/ไม่ปกติ)',
  trip: 'รายละเอียด (แรงดันไฟฟ้า)',
  equipment_detail: 'รายละเอียด (อุปกรณ์)',
}

const SUB_TYPE_ICON: Record<SubItemType, string> = {
  checkbox: '✓',
  trip: '⚡',
  equipment_detail: '🔩',
}

const SUB_TYPE_COLOR: Record<SubItemType, string> = {
  checkbox: 'bg-green-50 text-green-700',
  trip: 'bg-blue-50 text-blue-700',
  equipment_detail: 'bg-orange-50 text-orange-700',
}

const SUB_TYPE_PREVIEW: Record<SubItemType, string> = {
  checkbox: '☐ ปกติ  ☐ ไม่ปกติ | ค่ามาตรฐาน | ค่าที่วัดได้ | คำแนะนำ',
  trip: 'ค่าที่วัดได้: __________',
  equipment_detail: 'Main Circuit / ชนิดสายไฟ / ขนาดสายเฟส / ขนาดสายนิวทรัล',
}

// ============================================================
// COMPONENT
// ============================================================
export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [search, setSearch] = useState('')

  const [showTopicModal, setShowTopicModal] = useState(false)
  const [showSubModal, setShowSubModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)

  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null)

  const [topicForm, setTopicForm] = useState({ title: '', description: '' })
  const [subForm, setSubForm] = useState<{ label: string; type: SubItemType }>({ label: '', type: 'checkbox' })
  const [configForm, setConfigForm] = useState({ branch_id: '', equipment_no: '', location: '' })

  const [subItems, setSubItems] = useState<SubItem[]>([])
  const [branchConfigs, setBranchConfigs] = useState<BranchConfig[]>([])

  const supabase = createClient()

  // ── FETCH ──
  const fetchAll = async () => {
    const [t, b] = await Promise.all([
      supabase.from('assessment_topics').select('*, configs:topic_branch_config(*, branch:branches(name))').order('sort_order'),
      supabase.from('branches').select('*').eq('active', true).order('name'),
    ])
    setTopics(t.data || [])
    setBranches(b.data || [])
  }

  useEffect(() => { fetchAll() }, [])

  // ── TOPIC CRUD ──
  const openAddTopic = () => {
    setEditingTopic(null)
    setTopicForm({ title: '', description: '' })
    setShowTopicModal(true)
  }

  const openEditTopic = (t: Topic) => {
    setEditingTopic(t)
    setTopicForm({ title: t.title, description: t.description || '' })
    setShowTopicModal(true)
  }

  const handleSaveTopic = async () => {
    if (!topicForm.title.trim()) { toast.error('กรุณาระบุชื่อหัวข้อ'); return }
    if (editingTopic) {
      const { error } = await supabase.from('assessment_topics').update(topicForm).eq('id', editingTopic.id)
      if (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message); return }
      toast.success('แก้ไขหัวข้อสำเร็จ')
    } else {
      const { error } = await supabase.from('assessment_topics').insert({ ...topicForm, active: true, sort_order: topics.length })
      if (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message); return }
      toast.success('เพิ่มหัวข้อสำเร็จ')
    }
    setShowTopicModal(false)
    fetchAll()
  }

  const handleDeleteTopic = async (id: string) => {
    if (!confirm('ยืนยันการลบหัวข้อนี้? หัวข้อย่อยและ config ทั้งหมดจะถูกลบด้วย')) return
    const { error } = await supabase.from('assessment_topics').delete().eq('id', id)
    if (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message); return }
    toast.success('ลบหัวข้อสำเร็จ')
    fetchAll()
  }

  const handleToggleTopic = async (id: string, active: boolean) => {
    const { error } = await supabase.from('assessment_topics').update({ active: !active }).eq('id', id)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    fetchAll()
  }

  // ── SUB ITEMS CRUD ──
  const openSubItems = async (t: Topic) => {
    setActiveTopic(t)
    const { data } = await supabase.from('topic_sub_items').select('*').eq('topic_id', t.id).order('sort_order')
    setSubItems(data || [])
    setSubForm({ label: '', type: 'checkbox' })
    setShowSubModal(true)
  }

  const handleAddSubItem = async () => {
    // equipment_detail ไม่ต้องการ label จาก user เพราะ fixed fields
    if (subForm.type !== 'equipment_detail' && !subForm.label.trim()) {
      toast.error('กรุณาระบุชื่อหัวข้อย่อย'); return
    }
    if (!activeTopic) return
    const { error } = await supabase.from('topic_sub_items').insert({
      topic_id: activeTopic.id,
      label: subForm.type === 'equipment_detail' ? 'รายละเอียด (อุปกรณ์)' : subForm.label,
      type: subForm.type,
      sort_order: subItems.length,
    })
    if (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message); return }
    toast.success('เพิ่มหัวข้อย่อยสำเร็จ')
    setSubForm(p => ({ ...p, label: '' }))
    const { data } = await supabase.from('topic_sub_items').select('*').eq('topic_id', activeTopic.id).order('sort_order')
    setSubItems(data || [])
  }

  const handleDeleteSubItem = async (id: string) => {
    if (!activeTopic) return
    const { error } = await supabase.from('topic_sub_items').delete().eq('id', id)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    const { data } = await supabase.from('topic_sub_items').select('*').eq('topic_id', activeTopic.id).order('sort_order')
    setSubItems(data || [])
    toast.success('ลบหัวข้อย่อยสำเร็จ')
  }

  // ── BRANCH CONFIG CRUD ──
  const openConfig = async (t: Topic) => {
    setActiveTopic(t)
    const { data } = await supabase.from('topic_branch_config').select('*, branch:branches(name)').eq('topic_id', t.id)
    setBranchConfigs(data || [])
    setConfigForm({ branch_id: branches[0]?.id || '', equipment_no: '', location: '' })
    setShowConfigModal(true)
  }

  const handleSaveConfig = async () => {
    if (!configForm.branch_id || !activeTopic) { toast.error('กรุณาเลือกสาขา'); return }
    const { error } = await supabase.from('topic_branch_config').upsert({
      topic_id: activeTopic.id,
      branch_id: configForm.branch_id,
      equipment_no: configForm.equipment_no || null,
      location: configForm.location || null,
    }, { onConflict: 'topic_id,branch_id' })
    if (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message); return }
    toast.success('บันทึก config สำเร็จ')
    setConfigForm({ branch_id: branches[0]?.id || '', equipment_no: '', location: '' })
    const { data } = await supabase.from('topic_branch_config').select('*, branch:branches(name)').eq('topic_id', activeTopic.id)
    setBranchConfigs(data || [])
    fetchAll()
  }

  const handleDeleteConfig = async (id: string) => {
    if (!activeTopic) return
    await supabase.from('topic_branch_config').delete().eq('id', id)
    const { data } = await supabase.from('topic_branch_config').select('*, branch:branches(name)').eq('topic_id', activeTopic.id)
    setBranchConfigs(data || [])
    fetchAll()
  }

  const filtered = topics.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาหัวข้อ..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        <button onClick={openAddTopic} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium whitespace-nowrap">
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
        ) : filtered.map(t => (
          <div key={t.id} className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50">
            <div className="col-span-2">
              <div className="text-sm font-medium text-gray-900">{t.title}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {t.configs && t.configs.length > 0 ? t.configs.map((c: BranchConfig) => (
                <span key={c.id} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{c.branch?.name}</span>
              )) : <span className="text-xs text-gray-300">ไม่มี</span>}
            </div>
            <div>
              <button onClick={() => handleToggleTopic(t.id, t.active)}
                className={`w-10 h-5 rounded-full transition-colors relative ${t.active ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${t.active ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => openEditTopic(t)} className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">แก้ไข</button>
              <button onClick={() => openConfig(t)} className="text-xs px-2 py-1 border border-blue-100 text-blue-600 rounded-lg hover:bg-blue-50">สาขา</button>
              <button onClick={() => openSubItems(t)} className="text-xs px-2 py-1 border border-green-100 text-green-600 rounded-lg hover:bg-green-50">ข้อย่อย</button>
              <button onClick={() => handleDeleteTopic(t.id)} className="text-xs px-2 py-1 border border-red-100 text-red-500 rounded-lg hover:bg-red-50">ลบ</button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: เพิ่ม/แก้ไขหัวข้อ */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-sm font-medium text-gray-900 mb-4">{editingTopic ? 'แก้ไขหัวข้อ' : 'เพิ่มหัวข้อใหม่'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ชื่อหัวข้อ</label>
                <input type="text" value={topicForm.title} onChange={e => setTopicForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">รายละเอียด</label>
                <textarea value={topicForm.description} onChange={e => setTopicForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowTopicModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600">ยกเลิก</button>
              <button onClick={handleSaveTopic} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ตั้งค่าสาขา */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-medium text-gray-900 mb-1">ตั้งค่าสาขา</h2>
            <p className="text-xs text-gray-400 mb-4">{activeTopic?.title}</p>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">สาขา</label>
                <select value={configForm.branch_id} onChange={e => setConfigForm(p => ({ ...p, branch_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white">
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">หมายเลขอุปกรณ์</label>
                <input type="text" value={configForm.equipment_no} onChange={e => setConfigForm(p => ({ ...p, equipment_no: e.target.value }))}
                  placeholder="เช่น MB245-789"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">สถานที่</label>
                <input type="text" value={configForm.location} onChange={e => setConfigForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="เช่น ห้องประชุม"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
              </div>
              <button onClick={handleSaveConfig} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">
                + เพิ่ม / อัปเดต config
              </button>
            </div>
            {branchConfigs.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">สาขาที่ตั้งค่าแล้ว</div>
                <div className="space-y-2">
                  {branchConfigs.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <span className="text-xs font-medium text-blue-600">{c.branch?.name}</span>
                        {c.equipment_no && <span className="text-xs text-gray-400 ml-2">🔧 {c.equipment_no}</span>}
                        {c.location && <span className="text-xs text-gray-400 ml-2">📍 {c.location}</span>}
                      </div>
                      <button onClick={() => handleDeleteConfig(c.id)} className="text-xs text-red-400 hover:text-red-600">ลบ</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setShowConfigModal(false)} className="w-full border border-gray-200 rounded-lg py-2 text-sm text-gray-600 mt-4">ปิด</button>
          </div>
        </div>
      )}

      {/* MODAL: จัดการหัวข้อย่อย */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-medium text-gray-900 mb-1">จัดการหัวข้อย่อย</h2>
            <p className="text-xs text-gray-400 mb-4">{activeTopic?.title}</p>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ประเภท</label>
                <select value={subForm.type}
                  onChange={e => setSubForm({ label: '', type: e.target.value as SubItemType })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white">
                  <option value="checkbox">✓ Checkbox (ปกติ/ไม่ปกติ)</option>
                  <option value="trip">⚡ รายละเอียด (แรงดันไฟฟ้า)</option>
                  <option value="equipment_detail">🔩 รายละเอียด (อุปกรณ์)</option>
                </select>
              </div>

              {/* ชื่อหัวข้อย่อย — ซ่อนสำหรับ equipment_detail เพราะ fixed */}
              {subForm.type !== 'equipment_detail' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อหัวข้อย่อย</label>
                  <input type="text" value={subForm.label}
                    onChange={e => setSubForm(p => ({ ...p, label: e.target.value }))}
                    placeholder={subForm.type === 'checkbox' ? 'เช่น ตรวจสอบสภาพภายนอก' : 'เช่น CB, L1-N, L2-N'}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
                    onKeyDown={e => e.key === 'Enter' && handleAddSubItem()} />
                </div>
              )}

              {/* Preview */}
              <div className="border border-dashed border-gray-200 rounded-lg p-3 bg-white">
                <div className="text-xs font-medium text-gray-400 mb-2">ช่องที่จะแสดงตอนตรวจจริง:</div>
                {subForm.type === 'checkbox' && (
                  <div className="space-y-0.5 text-xs text-gray-400">
                    <div>ค่ามาตรฐาน | ค่าที่วัดได้ | ☐ ปกติ | ☐ ไม่ปกติ | คำแนะนำ</div>
                  </div>
                )}
                {subForm.type === 'trip' && (
                  <div className="text-xs text-gray-400">ค่าที่วัดได้: __________</div>
                )}
                {subForm.type === 'equipment_detail' && (
                  <div className="space-y-0.5 text-xs text-gray-400">
                    <div>Main Circuit: __________</div>
                    <div>ชนิดสายไฟ: __________</div>
                    <div>ขนาดสายเฟส (Sq.mm.): __________</div>
                    <div>ขนาดสายนิวทรัล (Sq.mm.): __________</div>
                  </div>
                )}
              </div>

              <button onClick={handleAddSubItem} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">
                + เพิ่มหัวข้อย่อย
              </button>
            </div>

            {subItems.length > 0 ? (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">หัวข้อย่อยทั้งหมด ({subItems.length} รายการ)</div>
                <div className="space-y-2">
                  {subItems.map((s, idx) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="text-sm mt-0.5 w-5 text-center">{SUB_TYPE_ICON[s.type]}</span>
                        <div>
                          <div className="text-xs font-medium text-gray-900">{idx + 1}. {s.label}</div>
                          <span className={`text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block ${SUB_TYPE_COLOR[s.type]}`}>
                            {SUB_TYPE_LABEL[s.type]}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteSubItem(s.id)}
                        className="text-xs px-2 py-1 border border-red-100 text-red-400 rounded-lg hover:bg-red-50 ml-2 flex-shrink-0">
                        ลบ
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-400">ยังไม่มีหัวข้อย่อย กรุณาเพิ่มด้านบน</div>
            )}

            <button onClick={() => setShowSubModal(false)} className="w-full border border-gray-200 rounded-lg py-2 text-sm text-gray-600 mt-4">ปิด</button>
          </div>
        </div>
      )}
    </div>
  )
}
