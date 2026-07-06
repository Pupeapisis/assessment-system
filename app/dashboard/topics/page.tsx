'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ============================================================
// TYPES
// ============================================================
type SubItemType =
  | 'checkbox'
  | 'trip'
  | 'equipment_detail'
  | 'door'
  | 'door_inspection'
  | 'socket_inspection'
  | 'sanitary_inspection'
  | 'emergency_inspection'
  | 'lighting_inspection'
  | 'fan'
  | 'fan_inspection'
  | 'fire_extinguisher_inspection'
  | 'exit_sign'
  | 'exit_sign_inspection'

// setup fields แต่ละ type (label ที่แสดงบน input)
const SETUP_FIELDS: Partial<Record<SubItemType, string[]>> = {
  door_inspection:               ['ชื่อหัวข้อย่อย'],
  socket_inspection:             ['ชื่อหัวข้อย่อย'],
  sanitary_inspection:           ['ชื่อหัวข้อย่อย'],
  emergency_inspection:          ['ชื่อหัวข้อย่อย', 'อุปกรณ์'],
  lighting_inspection:           ['ชื่อหัวข้อย่อย', 'ชนิดโคมไฟ'],
  fan_inspection:                ['ชื่อหัวข้อย่อย', 'อุปกรณ์', 'หมายเลขเครื่อง'],
  fire_extinguisher_inspection:  ['ชื่อหัวข้อย่อย', 'หมายเลขถัง', 'ประเภท', 'ขนาด'],
  exit_sign_inspection:          ['ชื่อหัวข้อย่อย', 'อุปกรณ์'],
}

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
  building: string | null
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
  door: 'ประตู',
  door_inspection: 'การตรวจประตู',
  socket_inspection: 'การตรวจเต้ารับไฟฟ้า',
  sanitary_inspection: 'การตรวจสุขภัณฑ์',
  emergency_inspection: 'การตรวจ Emergency',
  lighting_inspection: 'การตรวจแสงสว่าง',
  fan: 'พัดลม',
  fan_inspection: 'การตรวจพัดลม',
  fire_extinguisher_inspection: 'การตรวจถังดับเพลิง',
  exit_sign: 'Emergency/Exit Sign',
  exit_sign_inspection: 'การตรวจ Emergency/Exit Sign',
}

const SUB_TYPE_COLOR: Record<SubItemType, string> = {
  checkbox: 'bg-green-50 text-green-700',
  trip: 'bg-blue-50 text-blue-700',
  equipment_detail: 'bg-orange-50 text-orange-700',
  door: 'bg-purple-50 text-purple-700',
  door_inspection: 'bg-purple-50 text-purple-700',
  socket_inspection: 'bg-yellow-50 text-yellow-700',
  sanitary_inspection: 'bg-cyan-50 text-cyan-700',
  emergency_inspection: 'bg-red-50 text-red-700',
  lighting_inspection: 'bg-amber-50 text-amber-700',
  fan: 'bg-sky-50 text-sky-700',
  fan_inspection: 'bg-sky-50 text-sky-700',
  fire_extinguisher_inspection: 'bg-rose-50 text-rose-700',
  exit_sign: 'bg-indigo-50 text-indigo-700',
  exit_sign_inspection: 'bg-indigo-50 text-indigo-700',
}

// type ที่ต้องการ label เดียวจาก user (เดิม)
const NEEDS_LABEL: SubItemType[] = ['checkbox', 'trip', 'equipment_detail']

// Preview content
const SUB_TYPE_PREVIEW_CONTENT: Record<SubItemType, React.ReactNode> = {
  checkbox: <div className="text-xs text-gray-400">ค่ามาตรฐาน | ค่าที่วัดได้ | ☐ ปกติ | ☐ ไม่ปกติ | คำแนะนำ</div>,
  trip: <div className="text-xs text-gray-400">ค่าที่วัดได้: __________</div>,
  equipment_detail: <div className="space-y-0.5 text-xs text-gray-400">
    <div>Main Circuit: __________</div>
    <div>ชนิดสายไฟ: __________</div>
    <div>ขนาดสายเฟส (Sq.mm.): __________</div>
    <div>ขนาดสายนิวทรัล (Sq.mm.): __________</div>
  </div>,
  door: <div className="space-y-1 text-xs text-gray-400">
    <div>☐ ประตูสำนักงาน &nbsp;&nbsp;☐ ประตูหนีไฟ</div>
  </div>,
  door_inspection: <div className="space-y-0.5 text-xs text-gray-400">
    <div>☐ ตรวจสอบฐานล่างประตู (ปกติ/ไม่ปกติ)</div>
    <div>☐ ตรวจสอบเสาข้างประตู (ปกติ/ไม่ปกติ)</div>
    <div>☐ ตรวจสอบบานพับประตู (ปกติ/ไม่ปกติ)</div>
    <div>☐ ตรวจสอบโช๊คประตูหนีไฟ (ปกติ/ไม่ปกติ)</div>
    <div>☐ ตรวจสอบคานผลักประตู (ปกติ/ไม่ปกติ)</div>
    <div>☐ ทำความสะอาด (ผ่าน/ไม่ผ่าน)</div>
    <div>คำแนะนำและการแก้ไข: __________</div>
  </div>,
  socket_inspection: <div className="space-y-0.5 text-xs text-gray-400">
    <div>☐ ตรวจสอบสภาพเต้ารับ (ปกติ/ไม่ปกติ)</div>
    <div>☐ ตรวจสอบสภาพบล็อคยึดเต้ารับ (ปกติ/ไม่ปกติ)</div>
    <div>☐ ตรวจสอบสภาพสายไฟก่อนเข้าเต้ารับ (ปกติ/ไม่ปกติ)</div>
    <div>☐ ตรวจสอบจุดเชื่อมต่อระหว่างบล็อคและท่อร้อยสาย (ปกติ/ไม่ปกติ)</div>
    <div>☐ ตรวจสอบสายดิน (ปกติ/ไม่ปกติ)</div>
    <div>☐ ทำความสะอาด (ผ่าน/ไม่ผ่าน)</div>
    <div>คำแนะนำและการแก้ไข: __________</div>
  </div>,
  sanitary_inspection: <div className="space-y-0.5 text-xs text-gray-400">
    <div>☐ ตรวจสอบสภาพสุขภัณฑ์ (ปกติ/ไม่ปกติ)</div>
    <div>☐ ฟลัชวาล์ว (ปกติ/ไม่ปกติ)</div>
    <div>☐ ข้อต่อท่อน้ำดี (ปกติ/ไม่ปกติ)</div>
    <div>☐ รอยรั่วซึมและยางกันซึม (ปกติ/ไม่ปกติ)</div>
    <div>☐ การทำงานของลูกลอย (ปกติ/ไม่ปกติ)</div>
    <div>☐ ถังเก็บน้ำและยาแนว (ปกติ/ไม่ปกติ)</div>
    <div>☐ การไหลของน้ำในระบบ (ปกติ/ไม่ปกติ)</div>
    <div>☐ กลิ่นบริเวณรอบๆ (มีกลิ่น/ไม่มีกลิ่น)</div>
    <div>☐ การยึดและทดสอบความแข็งแรง (ปกติ/ไม่ปกติ)</div>
    <div>คำแนะนำและการแก้ไข: __________</div>
  </div>,
  emergency_inspection: <div className="space-y-0.5 text-xs text-gray-400">
    <div className="font-medium text-gray-500">บันทึกค่าตามจริง:</div>
    <div>แหล่งจ่ายไฟ AC Emergency Light (220V): __________</div>
    <div className="font-medium text-gray-500 mt-1">ตรวจสภาพ:</div>
    <div>☐ สภาวะการ Charging (หลอดดับ/กระพริบ) (ปกติ/ไม่ปกติ)</div>
    <div>☐ ค่าที่ Charging ได้ (หลอดแสดง Full) (ปกติ/ไม่ปกติ)</div>
    <div>☐ Test Battery ไปหลอด 5 วินาที (ปกติ/ไม่ปกติ)</div>
    <div>☐ สภาพการชำรุด/LED (ปกติ/ไม่ปกติ)</div>
    <div>☐ สภาพการชำรุด/ฟิวส์ (ปกติ/ไม่ปกติ)</div>
    <div>☐ สภาพการชำรุด/หลอดไฟ (ปกติ/ไม่ปกติ)</div>
    <div>☐ ทดสอบเปิดต่อเนื่อง 90 นาที (ปกติ/ไม่ปกติ)</div>
    <div>คำแนะนำและแนวทางแก้ไข: __________</div>
  </div>,
  lighting_inspection: <div className="space-y-0.5 text-xs text-gray-400">
    <div>☐ สภาพความสมบูรณ์ของโคมไฟฟ้า (ปกติ/ไม่ปกติ)</div>
    <div>☐ ขั้วรับหลอด (ปกติ/ไม่ปกติ)</div>
    <div>☐ สภาพหลอดไฟฟ้า (ปกติ/ไม่ปกติ)</div>
    <div>☐ บล็อคและสวิตช์ควบคุม (ปกติ/ไม่ปกติ)</div>
    <div>☐ การติดตั้งโคมไฟ (ปกติ/ไม่ปกติ)</div>
    <div>☐ ค่าความสว่างภายในห้อง (ปกติ/ไม่ปกติ)</div>
    <div>คำแนะนำและการแก้ไข: __________</div>
  </div>,
  fan: <div className="space-y-1 text-xs text-gray-400">
    <div>☐ พัดลมโคจร &nbsp;&nbsp;☐ พัดลมติดผนัง &nbsp;&nbsp;☐ พัดลมระบายอากาศ</div>
  </div>,
  fan_inspection: <div className="space-y-0.5 text-xs text-gray-400">
    <div className="font-medium text-gray-500">บันทึกค่าตามจริง:</div>
    <div>กระแสมอเตอร์ (A): __________</div>
    <div>แรงดันไฟฟ้า (220/380) (V): __________</div>
    <div className="font-medium text-gray-500 mt-1">ตรวจสภาพ:</div>
    <div>☐ การทำงานของพัดลม (ปกติ/ไม่ปกติ)</div>
    <div>☐ สภาพสายไฟและใบพัดลม (ปกติ/ไม่ปกติ)</div>
    <div>☐ การสั่นสะเทือนของมอเตอร์ (ปกติ/ไม่ปกติ)</div>
    <div>☐ ไขน็อตให้แน่นและทำความสะอาด (ผ่าน/ไม่ผ่าน)</div>
    <div>คำแนะนำและการแก้ไข: __________</div>
  </div>,
  fire_extinguisher_inspection: <div className="space-y-0.5 text-xs text-gray-400">
    <div>☐ สายฉีด (ปกติ/ไม่ปกติ)</div>
    <div>☐ คันบังคับ (ปกติ/ไม่ปกติ)</div>
    <div>☐ ตัวถัง (ปกติ/ไม่ปกติ)</div>
    <div>☐ เกจความดัน/น้ำหนัก (ปกติ/ไม่ปกติ)</div>
    <div>☐ สิ่งกีดขวาง (ปกติ/ไม่ปกติ)</div>
    <div>คำแนะนำและการแก้ไข: __________</div>
  </div>,
  exit_sign: <div className="space-y-1 text-xs text-gray-400">
    <div>☐ ตู้ไฟแสงสว่างฉุกเฉิน &nbsp;&nbsp;☐ ป้ายบอกทางหนีไฟ</div>
  </div>,
  exit_sign_inspection: <div className="space-y-0.5 text-xs text-gray-400">
    <div className="font-medium text-gray-500">บันทึกค่าตามจริง:</div>
    <div>แหล่งจ่ายไฟ AC Emergency Light (220V): __________</div>
    <div className="font-medium text-gray-500 mt-1">ตรวจสภาพ:</div>
    <div>☐ สภาวะการ Charging (หลอดดับ/กระพริบ) (ปกติ/ไม่ปกติ)</div>
    <div>☐ ค่าที่ Charging ได้ (หลอดแสดง Full) (ปกติ/ไม่ปกติ)</div>
    <div>☐ Test Battery ไปหลอด 5 วินาที (ปกติ/ไม่ปกติ)</div>
    <div>☐ LED (ปกติ/ไม่ปกติ)</div>
    <div>☐ ฟิวส์ (ปกติ/ไม่ปกติ)</div>
    <div>☐ หลอดไฟ (ปกติ/ไม่ปกติ)</div>
    <div>☐ ทดสอบเปิดต่อเนื่อง 90 นาที (ปกติ/ไม่ปกติ)</div>
    <div>คำแนะนำและการแก้ไข: __________</div>
  </div>,
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
  const [editingConfig, setEditingConfig] = useState<BranchConfig | null>(null)

  const [topicForm, setTopicForm] = useState({ title: '', description: '' })

  // subForm: label สำหรับ NEEDS_LABEL, setupFields สำหรับ type ใหม่
  const [subForm, setSubForm] = useState<{
    label: string
    type: SubItemType
    setupFields: Record<string, string>
  }>({ label: '', type: 'checkbox', setupFields: {} })

  const [configForm, setConfigForm] = useState({ branch_id: '', building: '', equipment_no: '', location: '' })

  const [subItems, setSubItems] = useState<SubItem[]>([])
  const [branchConfigs, setBranchConfigs] = useState<BranchConfig[]>([])

  const supabase = createClient()

  // reset setupFields เมื่อเปลี่ยน type
  const handleTypeChange = (type: SubItemType) => {
    const fields = SETUP_FIELDS[type] || []
    const setupFields: Record<string, string> = {}
    fields.forEach(f => { setupFields[f] = '' })
    setSubForm({ label: '', type, setupFields })
  }

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
    setSubForm({ label: '', type: 'checkbox', setupFields: {} })
    setShowSubModal(true)
  }

  const handleAddSubItem = async () => {
    if (!activeTopic) return

    // validate
    if (NEEDS_LABEL.includes(subForm.type)) {
      if (!subForm.label.trim()) { toast.error('กรุณาระบุชื่อหัวข้อย่อย'); return }
    } else if (SETUP_FIELDS[subForm.type]) {
      const fields = SETUP_FIELDS[subForm.type]!
      for (const f of fields) {
        if (!subForm.setupFields[f]?.trim()) {
          toast.error(`กรุณาระบุ${f}`); return
        }
      }
    }

    // label ที่แสดงใน list — ใช้ field แรก (ชื่อหัวข้อย่อย) ถ้ามี
    const fields = SETUP_FIELDS[subForm.type]
    const label = NEEDS_LABEL.includes(subForm.type)
      ? subForm.label
      : fields && fields.length > 0
        ? subForm.setupFields[fields[0]] || SUB_TYPE_LABEL[subForm.type]
        : SUB_TYPE_LABEL[subForm.type]

    // extra_data เก็บ setupFields ทั้งหมด
    const extra_data = fields && fields.length > 0 ? subForm.setupFields : null

    const { error } = await supabase.from('topic_sub_items').insert({
      topic_id: activeTopic.id,
      label,
      type: subForm.type,
      sort_order: subItems.length,
      ...(extra_data ? { extra_data } : {}),
    })
    if (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message); return }
    toast.success('เพิ่มหัวข้อย่อยสำเร็จ')

    // reset
    handleTypeChange(subForm.type)

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
    const { data } = await supabase
      .from('topic_branch_config')
      .select('*, branch:branches(name)')
      .eq('topic_id', t.id)
    console.log('TOPIC', t.title)
    console.log('CONFIGS', data)
    setBranchConfigs(data || [])
    setConfigForm({ branch_id: branches[0]?.id || '', building: '', equipment_no: '', location: '' })
    setShowConfigModal(true)
  }

  const handleSaveConfig = async () => {
    if (!configForm.branch_id || !activeTopic) { toast.error('กรุณาเลือกสาขา'); return }
    const { error } = await supabase.from('topic_branch_config').upsert({
      topic_id: activeTopic.id,
      branch_id: configForm.branch_id,
      building: configForm.building || null,
      equipment_no: configForm.equipment_no || null,
      location: configForm.location || null,
    }, { onConflict: 'topic_id,branch_id' })
    if (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message); return }
    toast.success('บันทึก config สำเร็จ')
    setConfigForm({ branch_id: branches[0]?.id || '', building: '', equipment_no: '', location: '' })
    setEditingConfig(null)
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
            <h2 className="text-sm font-medium text-gray-900 mb-1">
              {editingConfig ? `✏️ แก้ไข Config : ${editingConfig.branch?.name || ''}` : 'ตั้งค่าสาขา'}
            </h2>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">อาคาร</label>
                <input type="text" value={configForm.building}
                  onChange={e => setConfigForm(p => ({ ...p, building: e.target.value }))}
                  placeholder="เช่น อาคาร A"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">หมายเลขอุปกรณ์</label>
                <input type="text" value={configForm.equipment_no}
                  onChange={e => setConfigForm(p => ({ ...p, equipment_no: e.target.value }))}
                  placeholder="เช่น MB245-789"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">สถานที่</label>
                <input type="text" value={configForm.location}
                  onChange={e => setConfigForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="เช่น ห้องประชุม"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
              </div>
              <div className="flex gap-2">
                {editingConfig && (
                  <button
                    onClick={() => {
                      setEditingConfig(null)
                      setConfigForm({ branch_id: branches[0]?.id || '', building: '', equipment_no: '', location: '' })
                    }}
                    className="px-4 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm"
                  >ยกเลิก</button>
                )}
                <button onClick={handleSaveConfig} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">
                  {editingConfig ? '💾 บันทึกการแก้ไข' : '+ เพิ่ม / อัปเดต Config'}
                </button>
              </div>
            </div>
            {branchConfigs.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">สาขาที่ตั้งค่าแล้ว</div>
                <div className="space-y-2">
                  {branchConfigs.map(c => (
                    <div key={c.id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${editingConfig?.id === c.id ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-blue-600">{c.branch?.name}</span>
                        {c.equipment_no && <span className="text-xs text-gray-400">🔧 {c.equipment_no}</span>}
                        {c.building && <span className="text-xs text-gray-400">🏢 {c.building}</span>}
                        {c.location && <span className="text-xs text-gray-400">📍 {c.location}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingConfig(c)
                            setConfigForm({ branch_id: c.branch_id, building: c.building || '', equipment_no: c.equipment_no || '', location: c.location || '' })
                          }}
                          className="text-xs px-2 py-1 border border-blue-200 text-blue-600 rounded">แก้ไข</button>
                        <button onClick={() => handleDeleteConfig(c.id)}
                          className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded">ลบ</button>
                      </div>
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
              {/* dropdown ประเภท */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ประเภท</label>
                <select value={subForm.type}
                  onChange={e => handleTypeChange(e.target.value as SubItemType)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white">
                  <option value="checkbox">✓ Checkbox (ปกติ/ไม่ปกติ)</option>
                  <option value="trip">⚡ รายละเอียด (แรงดันไฟฟ้า)</option>
                  <option value="equipment_detail">🔩 รายละเอียด (อุปกรณ์)</option>
                  <option disabled>──────────────</option>
                  <option value="door">🚪 ประตู</option>
                  <option value="door_inspection">🚪 การตรวจประตู</option>
                  <option value="socket_inspection">🔌 การตรวจเต้ารับไฟฟ้า</option>
                  <option value="sanitary_inspection">🚿 การตรวจสุขภัณฑ์</option>
                  <option value="emergency_inspection">🔦 การตรวจ Emergency</option>
                  <option value="lighting_inspection">💡 การตรวจแสงสว่าง</option>
                  <option value="fan">🌀 พัดลม</option>
                  <option value="fan_inspection">🌀 การตรวจพัดลม</option>
                  <option value="fire_extinguisher_inspection">🧯 การตรวจถังดับเพลิง</option>
                  <option value="exit_sign">🚨 Emergency/Exit Sign</option>
                  <option value="exit_sign_inspection">🚨 การตรวจ Emergency/Exit Sign</option>
                </select>
              </div>

              {/* input เดียว สำหรับ checkbox, trip, equipment_detail */}
              {NEEDS_LABEL.includes(subForm.type) && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อหัวข้อย่อย</label>
                  <input type="text" value={subForm.label}
                    onChange={e => setSubForm(p => ({ ...p, label: e.target.value }))}
                    placeholder={
                      subForm.type === 'checkbox' ? 'เช่น ตรวจสอบสภาพภายนอก' :
                      subForm.type === 'trip' ? 'เช่น CB, L1-N, L2-N' :
                      'เช่น Main Circuit, ชนิดสายไฟ'
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
                    onKeyDown={e => e.key === 'Enter' && handleAddSubItem()} />
                </div>
              )}

              {/* input หลายช่อง สำหรับ type ใหม่ที่มี SETUP_FIELDS */}
              {SETUP_FIELDS[subForm.type] && (
                <div className="space-y-2">
                  {SETUP_FIELDS[subForm.type]!.map(fieldLabel => (
                    <div key={fieldLabel}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{fieldLabel}</label>
                      <input
                        type="text"
                        value={subForm.setupFields[fieldLabel] || ''}
                        onChange={e => setSubForm(p => ({
                          ...p,
                          setupFields: { ...p.setupFields, [fieldLabel]: e.target.value }
                        }))}
                        placeholder={`ระบุ${fieldLabel}`}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Preview */}
              <div className="border border-dashed border-gray-200 rounded-lg p-3 bg-white">
                <div className="text-xs font-medium text-gray-400 mb-2">ช่องที่จะแสดงตอนตรวจจริง:</div>
                {SUB_TYPE_PREVIEW_CONTENT[subForm.type]}
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
                        <div>
                          <div className="text-xs font-medium text-gray-900">{idx + 1}. {s.label}</div>
                          <span className={`text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block ${SUB_TYPE_COLOR[s.type] ?? 'bg-gray-50 text-gray-600'}`}>
                            {SUB_TYPE_LABEL[s.type] ?? s.type}
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