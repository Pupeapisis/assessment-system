'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ============================================================
// TYPES
// ============================================================
type SubItemType =
  | 'checkbox' | 'trip' | 'equipment_detail'
  | 'door' | 'door_inspection' | 'socket_inspection'
  | 'sanitary_inspection' | 'emergency_inspection' | 'lighting_inspection'
  | 'fan' | 'fan_inspection' | 'fire_extinguisher_inspection'
  | 'exit_sign' | 'exit_sign_inspection'

interface SubItemResult {
  id: string
  sub_item_id: string
  status: 'normal' | 'abnormal' | null
  measured_value: string | null
  note: string | null
  standard_value: string | null
  main_circuit: string | null
  cable_type: string | null
  phase_size: string | null
  neutral_size: string | null
  extra_data: Record<string, string> | null
  sub_item?: {
    label: string
    type: SubItemType
    standard_value: string | null
    extra_data?: Record<string, string> | null
  }
}

interface AssessmentResult {
  id: string
  topic_id: string
  remark: string | null
  comment: string | null
  topic?: {
    title: string
    configs?: {
      branch_id: string
      building: string | null
      equipment_no: string | null
      location: string | null
    }[]
  }
  images?: { id: string; image_url: string; file_name: string | null }[]
  sub_results?: SubItemResult[]
}

interface Assessment {
  id: string
  branch_name: string
  branch_id: string | null
  created_at: string
  user?: { name: string }
}

// ============================================================
// HELPERS
// ============================================================
const toBase64 = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch { return '' }
}

const statusLabel = (status: string | null) =>
  status === 'abnormal' ? '✗ ไม่ปกติ' : '✓ ปกติ'

const statusColor = (status: string | null) =>
  status === 'abnormal' ? 'color:#dc2626' : 'color:#16a34a'

const boolLabel = (v: string | null | undefined) => v === 'true' ? '☑' : '☐'

const ex = (data: Record<string, string> | null | undefined, key: string) => data?.[key] || '-'

const exStatusLabel = (data: Record<string, string> | null | undefined, key: string) => {
  const v = data?.[key]
  if (!v || v === 'normal') return { label: '✓ ปกติ', color: 'color:#16a34a' }
  return { label: '✗ ไม่ปกติ', color: 'color:#dc2626' }
}
const exPassLabel = (data: Record<string, string> | null | undefined, key: string) => {
  const v = data?.[key]
  if (!v || v === 'normal') return { label: '✓ ผ่าน', color: 'color:#16a34a' }
  return { label: '✗ ไม่ผ่าน', color: 'color:#dc2626' }
}
const exOdorLabel = (data: Record<string, string> | null | undefined, key: string) => {
  const v = data?.[key]
  if (v === 'abnormal') return { label: 'มีกลิ่น', color: 'color:#d97706' }
  return { label: 'ไม่มีกลิ่น', color: 'color:#16a34a' }
}

// ============================================================
// TYPE SCHEMAS — columns แต่ละ type
// ============================================================
type ColDef = { header: string; key: string; kind: 'status'|'pass'|'odor'|'measured'|'bool'|'text'; unit?: string }

const TYPE_SCHEMAS: Partial<Record<SubItemType, { setupKeys: string[]; cols: ColDef[] }>> = {
  door: {
    setupKeys: [],
    cols: [
      { header: 'ประตูสำนักงาน', key: 'office_door', kind: 'bool' },
      { header: 'ประตูหนีไฟ', key: 'fire_door', kind: 'bool' },
    ],
  },
  door_inspection: {
    setupKeys: ['ชื่อหัวข้อย่อย'],
    cols: [
      { header: 'ฐานล่างประตู', key: 'bottom_base_check', kind: 'status' },
      { header: 'เสาข้างประตู', key: 'side_post_check', kind: 'status' },
      { header: 'บานพับประตู', key: 'hinge_check', kind: 'status' },
      { header: 'โช๊คประตูหนีไฟ', key: 'door_closer_check', kind: 'status' },
      { header: 'คานผลักประตู', key: 'push_bar_check', kind: 'status' },
      { header: 'ทำความสะอาด', key: 'cleaning_check', kind: 'pass' },
      { header: 'คำแนะนำ', key: 'recommendation', kind: 'text' },
    ],
  },
  socket_inspection: {
    setupKeys: ['ชื่อหัวข้อย่อย'],
    cols: [
      { header: 'สภาพเต้ารับ', key: 'socket_condition_check', kind: 'status' },
      { header: 'บล็อคยึดเต้ารับ', key: 'box_fixing_check', kind: 'status' },
      { header: 'สายไฟก่อนเต้ารับ', key: 'wire_before_socket_check', kind: 'status' },
      { header: 'จุดเชื่อมบล็อค-ท่อ', key: 'conduit_joint_check', kind: 'status' },
      { header: 'สายดิน', key: 'ground_wire_check', kind: 'status' },
      { header: 'ทำความสะอาด', key: 'cleaning_check', kind: 'pass' },
      { header: 'คำแนะนำ', key: 'recommendation', kind: 'text' },
    ],
  },
  sanitary_inspection: {
    setupKeys: ['ชื่อหัวข้อย่อย'],
    cols: [
      { header: 'สภาพสุขภัณฑ์', key: 'sanitary_condition_check', kind: 'status' },
      { header: 'ฟลัชวาล์ว', key: 'flush_valve_check', kind: 'status' },
      { header: 'ข้อต่อท่อน้ำดี', key: 'inlet_joint_check', kind: 'status' },
      { header: 'รอยรั่วซึม', key: 'leakage_and_washer_check', kind: 'status' },
      { header: 'ลูกลอย', key: 'float_valve_check', kind: 'status' },
      { header: 'ถังเก็บน้ำ', key: 'water_tank_grout_check', kind: 'status' },
      { header: 'การไหลของน้ำ', key: 'water_flow_check', kind: 'status' },
      { header: 'กลิ่น', key: 'odor_check', kind: 'odor' },
      { header: 'การยึด', key: 'stability_test_check', kind: 'status' },
      { header: 'คำแนะนำ', key: 'recommendation', kind: 'text' },
    ],
  },
  emergency_inspection: {
    setupKeys: ['ชื่อหัวข้อย่อย', 'อุปกรณ์'],
    cols: [
      { header: 'AC 220V', key: 'ac_power_voltage', kind: 'measured', unit: 'V' },
      { header: 'Charging สภาวะ', key: 'dc_charging_status_check', kind: 'status' },
      { header: 'Charging Full', key: 'dc_charging_full_check', kind: 'status' },
      { header: 'Test Battery 5วิ', key: 'battery_test_5s_check', kind: 'status' },
      { header: 'LED', key: 'led_condition_check', kind: 'status' },
      { header: 'ฟิวส์', key: 'fuse_condition_check', kind: 'status' },
      { header: 'หลอดไฟ', key: 'lamp_condition_check', kind: 'status' },
      { header: '90 นาที', key: 'test_90mins_check', kind: 'status' },
      { header: 'คำแนะนำ', key: 'recommendation', kind: 'text' },
    ],
  },
  lighting_inspection: {
    setupKeys: ['ชื่อหัวข้อย่อย', 'ชนิดโคมไฟ'],
    cols: [
      { header: 'สภาพโคมไฟ', key: 'fixture_condition_check', kind: 'status' },
      { header: 'ขั้วรับหลอด', key: 'socket_condition_check', kind: 'status' },
      { header: 'หลอดไฟฟ้า', key: 'lamp_condition_check', kind: 'status' },
      { header: 'บล็อค-สวิตช์', key: 'switch_control_check', kind: 'status' },
      { header: 'การติดตั้ง', key: 'installation_check', kind: 'status' },
      { header: 'ค่าความสว่าง', key: 'lux_level_check', kind: 'status' },
      { header: 'คำแนะนำ', key: 'recommendation', kind: 'text' },
    ],
  },
  fan: {
    setupKeys: [],
    cols: [
      { header: 'พัดลมโคจร', key: 'orbit_fan', kind: 'bool' },
      { header: 'พัดลมติดผนัง', key: 'wall_fan', kind: 'bool' },
      { header: 'พัดลมระบายอากาศ', key: 'exhaust_fan', kind: 'bool' },
    ],
  },
  fan_inspection: {
    setupKeys: ['ชื่อหัวข้อย่อย', 'อุปกรณ์', 'หมายเลขเครื่อง'],
    cols: [
      { header: 'กระแส (A)', key: 'motor_current', kind: 'measured', unit: 'A' },
      { header: 'แรงดัน (V)', key: 'voltage', kind: 'measured', unit: 'V' },
      { header: 'การทำงาน', key: 'fan_operation_check', kind: 'status' },
      { header: 'สายไฟ-ใบพัด', key: 'wiring_and_blade_check', kind: 'status' },
      { header: 'สั่นสะเทือน', key: 'motor_vibration_check', kind: 'status' },
      { header: 'ไขน็อต-ทำความสะอาด', key: 'tightening_and_cleaning_check', kind: 'pass' },
      { header: 'คำแนะนำ', key: 'recommendation', kind: 'text' },
    ],
  },
  fire_extinguisher_inspection: {
    setupKeys: ['ชื่อหัวข้อย่อย', 'หมายเลขถัง', 'ประเภท', 'ขนาด'],
    cols: [
      { header: 'สายฉีด', key: 'hose_check', kind: 'status' },
      { header: 'คันบังคับ', key: 'lever_check', kind: 'status' },
      { header: 'ตัวถัง', key: 'cylinder_check', kind: 'status' },
      { header: 'เกจ/น้ำหนัก', key: 'pressure_gauge_weight_check', kind: 'status' },
      { header: 'สิ่งกีดขวาง', key: 'obstruction_check', kind: 'status' },
      { header: 'คำแนะนำ', key: 'recommendation', kind: 'text' },
    ],
  },
  exit_sign: {
    setupKeys: [],
    cols: [
      { header: 'ตู้ไฟฉุกเฉิน', key: 'emergency_light_box', kind: 'bool' },
      { header: 'ป้ายหนีไฟ', key: 'exit_sign_board', kind: 'bool' },
    ],
  },
  exit_sign_inspection: {
    setupKeys: ['ชื่อหัวข้อย่อย', 'อุปกรณ์'],
    cols: [
      { header: 'AC 220V', key: 'ac_power_voltage', kind: 'measured', unit: 'V' },
      { header: 'Charging สภาวะ', key: 'charging_status_check', kind: 'status' },
      { header: 'Charging Full', key: 'charging_full_check', kind: 'status' },
      { header: 'Test Battery 5วิ', key: 'battery_test_5s_check', kind: 'status' },
      { header: 'LED', key: 'led_check', kind: 'status' },
      { header: 'ฟิวส์', key: 'fuse_check', kind: 'status' },
      { header: 'หลอดไฟ', key: 'lamp_check', kind: 'status' },
      { header: '90 นาที', key: 'test_90mins_check', kind: 'status' },
      { header: 'คำแนะนำ', key: 'recommendation', kind: 'text' },
    ],
  },
}

// ── render cell value ──
const getCellValue = (d: Record<string, string> | null | undefined, col: ColDef): string => {
  if (!d) return '-'
  if (col.kind === 'status') return exStatusLabel(d, col.key).label
  if (col.kind === 'pass') return exPassLabel(d, col.key).label
  if (col.kind === 'odor') return exOdorLabel(d, col.key).label
  if (col.kind === 'bool') return boolLabel(d[col.key])
  if (col.kind === 'measured') return d[col.key] ? `${d[col.key]} ${col.unit || ''}` : '-'
  return d[col.key] || '-'
}

const getCellColor = (d: Record<string, string> | null | undefined, col: ColDef): string => {
  if (!d) return ''
  if (col.kind === 'status') return exStatusLabel(d, col.key).color
  if (col.kind === 'pass') return exPassLabel(d, col.key).color
  if (col.kind === 'odor') return exOdorLabel(d, col.key).color
  return ''
}

const getCellCls = (d: Record<string, string> | null | undefined, col: ColDef): string => {
  if (!d) return ''
  const v = d[col.key]
  if (col.kind === 'status') return v === 'abnormal' ? 'text-red-600 font-medium' : 'text-green-600 font-medium'
  if (col.kind === 'pass') return v === 'abnormal' ? 'text-red-600 font-medium' : 'text-green-600 font-medium'
  if (col.kind === 'odor') return v === 'abnormal' ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'
  return 'text-gray-700'
}

// ============================================================
// PDF: render horizontal table per sub-item
// ============================================================
const renderExtraDataPdf = (items: SubItemResult[], type: SubItemType): string => {
  const schema = TYPE_SCHEMAS[type]
  if (!schema) return ''

  const setupKeys = schema.setupKeys
  const cols = schema.cols

  // header row: รายการ | col1 | col2 | ...
  const thStyle = 'border:1px solid #dbeafe;padding:1.5mm 2mm;text-align:center;font-size:8pt;background:#eff6ff;word-break:keep-all'
  const tdStyle = 'border:1px solid #e5e7eb;padding:1.5mm 2mm;text-align:center;font-size:8pt;word-break:keep-all'
  const tdLabelStyle = 'border:1px solid #e5e7eb;padding:1.5mm 2mm;font-size:8pt;word-break:keep-all'

  const headerCols = cols.map(c => `<th style="${thStyle}">${c.header}</th>`).join('')
  const rows = items.map((s, i) => {
    const d = s.extra_data
    const setup = s.sub_item?.extra_data
    // label cell: แสดง setup fields
    const labelParts = setupKeys.map(k => setup?.[k] || '').filter(Boolean)
    const labelCell = labelParts.join(' / ') || s.sub_item?.label || '-'
    const dataCells = cols.map(col => {
      const val = getCellValue(d, col)
      const color = getCellColor(d, col)
      return `<td style="${tdStyle};${color ? `font-weight:bold;${color}` : 'color:#374151'}">${val}</td>`
    }).join('')
    return `<tr style="${i % 2 === 0 ? 'background:#f9fafb' : 'background:#fff'}">
      <td style="${tdLabelStyle}">${labelCell}</td>
      ${dataCells}
    </tr>`
  }).join('')

  return `
    <div style="margin-bottom:4mm;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;table-layout:auto">
        <thead>
          <tr>
            <th style="${thStyle};text-align:left">รายการ</th>
            ${headerCols}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
}

// ============================================================
// PREVIEW: render horizontal table per group of same-type items
// ============================================================
const OLD_TYPES = ['checkbox', 'trip', 'equipment_detail']

function ExtraDataPreviewTable({ items, type }: { items: SubItemResult[]; type: SubItemType }) {
  const schema = TYPE_SCHEMAS[type]
  if (!schema || items.length === 0) return null

  const { setupKeys, cols } = schema

  return (
    <div className="mt-1 border border-gray-200 rounded overflow-hidden overflow-x-auto">
      <table className="w-full border-collapse text-xs" style={{ minWidth: `${(cols.length + 1) * 60}px` }}>
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left text-gray-500 font-medium border-b border-gray-200 whitespace-nowrap">รายการ</th>
            {cols.map(c => (
              <th key={c.key} className="px-2 py-1 text-center text-gray-500 font-medium border-b border-gray-200 whitespace-nowrap">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((s, i) => {
            const d = s.extra_data
            const setup = s.sub_item?.extra_data
            const labelParts = setupKeys.map(k => setup?.[k] || '').filter(Boolean)
            const label = labelParts.join(' / ') || s.sub_item?.label || '-'
            return (
              <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1 text-gray-700 border-t border-gray-100 whitespace-nowrap">{label}</td>
                {cols.map(col => (
                  <td key={col.key} className={`px-2 py-1 text-center border-t border-gray-100 whitespace-nowrap ${getCellCls(d, col)}`}>
                    {getCellValue(d, col)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================
// COMPONENT
// ============================================================
export default function ReportPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [selected, setSelected] = useState<Assessment | null>(null)
  const [results, setResults] = useState<AssessmentResult[]>([])
  const [reportName, setReportName] = useState('รายงานการตรวจประเมิน')
  const [showSubItems, setShowSubItems] = useState(true)
  const [showComments, setShowComments] = useState(true)
  const [showImages, setShowImages] = useState(true)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Assessment | null>(null)
  const [editForm, setEditForm] = useState({ branch_name: '', inspector_name: '', inspect_date: '' })

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [editingResults, setEditingResults] = useState<Record<string, Partial<AssessmentResult>>>({})
  const [editingSubResults, setEditingSubResults] = useState<Record<string, Partial<SubItemResult>>>({})

  const supabase = createClient()

  const fetchAssessments = async () => {
    const { data } = await supabase.from('assessments').select('*, user:users(name)').order('created_at', { ascending: false })
    setAssessments(data || [])
  }

  useEffect(() => { fetchAssessments() }, [])

  const selectAssessment = async (a: Assessment) => {
    setSelected(a)
    const { data, error } = await supabase
      .from('assessment_results')
      .select(`
        *,
        topic:assessment_topics(title, category:assessment_categories(name), configs:topic_branch_config(branch_id, building, equipment_no, location)),
        images:assessment_images(*),
        sub_results:result_sub_items(*, sub_item:topic_sub_items(label, type, standard_value, extra_data))
      `)
      .eq('assessment_id', a.id)
    if (error) { toast.error('โหลดข้อมูลไม่สำเร็จ'); return }
    setResults(data || [])
  }

  const getBranchMeta = (r: AssessmentResult) => {
    if (!selected?.branch_id || !r.topic?.configs) return null
    return r.topic.configs.find(c => c.branch_id === selected.branch_id) || null
  }

  const saveResultsToDb = async () => {
    if (!selected) return
    setSaveStatus('saving'); setIsSaving(true)
    try {
      for (const resultId in editingResults) {
        const edited = editingResults[resultId]
        const result = results.find(r => r.id === resultId)
        if (!result) continue
        const { error } = await supabase.from('assessment_results').update({
          remark: edited.remark !== undefined ? edited.remark : result.remark,
          comment: edited.comment !== undefined ? edited.comment : result.comment,
        }).eq('id', resultId)
        if (error) throw error
      }
      for (const subResultId in editingSubResults) {
        const edited = editingSubResults[subResultId]
        const { error } = await supabase.from('result_sub_items').update({
          status: edited.status !== undefined ? edited.status : null,
          measured_value: edited.measured_value !== undefined ? edited.measured_value : null,
          note: edited.note !== undefined ? edited.note : null,
          standard_value: edited.standard_value !== undefined ? edited.standard_value : null,
          main_circuit: edited.main_circuit !== undefined ? edited.main_circuit : null,
          cable_type: edited.cable_type !== undefined ? edited.cable_type : null,
          phase_size: edited.phase_size !== undefined ? edited.phase_size : null,
          neutral_size: edited.neutral_size !== undefined ? edited.neutral_size : null,
          extra_data: edited.extra_data !== undefined ? edited.extra_data : null,
        }).eq('id', subResultId)
        if (error) throw error
      }
      if (selected) await selectAssessment(selected)
      setEditingResults({}); setEditingSubResults({})
      setSaveStatus('saved'); toast.success('บันทึกสำเร็จ ✓')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err: any) {
      setSaveStatus('idle'); toast.error('บันทึกไม่สำเร็จ: ' + (err.message || 'เกิดข้อผิดพลาด'))
    } finally { setIsSaving(false) }
  }

  useEffect(() => {
    if (!selected || (Object.keys(editingResults).length === 0 && Object.keys(editingSubResults).length === 0)) return
    const interval = setInterval(() => { saveResultsToDb() }, 30000)
    return () => clearInterval(interval)
  }, [selected, editingResults, editingSubResults])

  const updateResultValue = (resultId: string, field: keyof AssessmentResult, value: any) => {
    setEditingResults(prev => ({ ...prev, [resultId]: { ...prev[resultId], [field]: value } }))
  }

  const updateSubResultValue = (subResultId: string, field: keyof SubItemResult, value: any) => {
    setEditingSubResults(prev => ({ ...prev, [subResultId]: { ...prev[subResultId], [field]: value } }))
  }

  const openEdit = (a: Assessment, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditTarget(a)
    setEditForm({ branch_name: a.branch_name, inspector_name: a.user?.name || '', inspect_date: new Date(a.created_at).toISOString().split('T')[0] })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    if (!editForm.branch_name.trim()) { toast.error('กรุณาระบุชื่อสาขา'); return }
    const { error } = await supabase.from('assessments').update({ branch_name: editForm.branch_name, updated_at: new Date().toISOString() }).eq('id', editTarget.id)
    if (error) { toast.error('แก้ไขไม่สำเร็จ: ' + error.message); return }
    toast.success('แก้ไขสำเร็จ')
    setShowEditModal(false)
    if (selected?.id === editTarget.id) setSelected(prev => prev ? { ...prev, branch_name: editForm.branch_name } : null)
    fetchAssessments()
  }

  const handleDelete = async (a: Assessment, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`ยืนยันการลบ "${a.branch_name}" ?\nข้อมูลทั้งหมดรวมถึงรูปภาพจะถูกลบถาวร`)) return
    const loadingToast = toast.loading('กำลังลบข้อมูล...')
    try {
      const { data: resultList } = await supabase.from('assessment_results').select('id').eq('assessment_id', a.id)
      if (resultList && resultList.length > 0) {
        const resultIds = resultList.map(r => r.id)
        const { data: imageList } = await supabase.from('assessment_images').select('image_url').in('result_id', resultIds)
        if (imageList && imageList.length > 0) {
          const paths = imageList.map(img => { try { const url = new URL(img.image_url); const parts = url.pathname.split('/assessment-images/'); return parts[1] || null } catch { return null } }).filter(Boolean) as string[]
          if (paths.length > 0) await supabase.storage.from('assessment-images').remove(paths)
        }
        await supabase.from('result_sub_items').delete().in('result_id', resultIds)
        await supabase.from('assessment_images').delete().in('result_id', resultIds)
        await supabase.from('assessment_results').delete().eq('assessment_id', a.id)
      }
      const { error } = await supabase.from('assessments').delete().eq('id', a.id)
      if (error) throw error
      toast.dismiss(loadingToast); toast.success('ลบสำเร็จ')
      if (selected?.id === a.id) { setSelected(null); setResults([]) }
      fetchAssessments()
    } catch (err: any) { toast.dismiss(loadingToast); toast.error('ลบไม่สำเร็จ: ' + err.message) }
  }

  // ============================================================
  // PRINT HTML
  // ============================================================
  const handlePrint = async () => {
    if (!selected) { toast.error('กรุณาเลือกแบบประเมินก่อน'); return }
    toast.loading('กำลังเตรียมรายงาน...')
    const dateStr = new Date(selected.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

    const pages = await Promise.all(results.map(async (r, idx) => {
      const meta = getBranchMeta(r)
      const checkboxItems = r.sub_results?.filter(s => s.sub_item?.type === 'checkbox') || []
      const tripItems = r.sub_results?.filter(s => s.sub_item?.type === 'trip') || []
      const equipItems = r.sub_results?.filter(s => s.sub_item?.type === 'equipment_detail') || []
      const newTypeItems = r.sub_results?.filter(s => s.sub_item?.type && !OLD_TYPES.includes(s.sub_item.type)) || []

      // group newTypeItems by type
      const newTypeGroups: Partial<Record<SubItemType, SubItemResult[]>> = {}
      newTypeItems.forEach(s => {
        const t = s.sub_item?.type as SubItemType
        if (!newTypeGroups[t]) newTypeGroups[t] = []
        newTypeGroups[t]!.push(s)
      })

      const checkboxTable = showSubItems && checkboxItems.length > 0 ? `
        <div style="margin-bottom:6mm">
          <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:2mm">รายการตรวจสอบ</div>
          <table style="width:100%;border-collapse:collapse;font-size:9.5pt">
            <thead>
              <tr style="background:#eff6ff">
                <th style="border:1px solid #dbeafe;padding:2mm 3mm;text-align:left;width:35%">รายการ</th>
                <th style="border:1px solid #dbeafe;padding:2mm 3mm;text-align:center;width:15%">ค่ามาตรฐาน</th>
                <th style="border:1px solid #dbeafe;padding:2mm 3mm;text-align:center;width:15%">ค่าที่วัดได้</th>
                <th style="border:1px solid #dbeafe;padding:2mm 3mm;text-align:center;width:15%">สถานะ</th>
                <th style="border:1px solid #dbeafe;padding:2mm 3mm;text-align:left">คำแนะนำ</th>
              </tr>
            </thead>
            <tbody>
              ${checkboxItems.map((s, i) => `
                <tr style="${i % 2 === 0 ? 'background:#f9fafb' : 'background:#fff'}">
                  <td style="border:1px solid #e5e7eb;padding:2mm 3mm">${s.sub_item?.label || ''}</td>
                  <td style="border:1px solid #e5e7eb;padding:2mm 3mm;text-align:center;color:#6b7280">${s.standard_value || s.sub_item?.standard_value || '-'}</td>
                  <td style="border:1px solid #e5e7eb;padding:2mm 3mm;text-align:center">${s.measured_value || '-'}</td>
                  <td style="border:1px solid #e5e7eb;padding:2mm 3mm;text-align:center;font-weight:bold;${statusColor(s.status)}">${statusLabel(s.status)}</td>
                  <td style="border:1px solid #e5e7eb;padding:2mm 3mm;color:#6b7280">${s.note || '-'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''

      const tripTable = showSubItems && tripItems.length > 0 ? `
        <div style="margin-bottom:6mm">
          <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:2mm">⚡ รายละเอียด (แรงดันไฟฟ้า)</div>
          <table style="width:100%;border-collapse:collapse;font-size:9.5pt">
            <thead>
              <tr style="background:#eff6ff">
                <th style="border:1px solid #dbeafe;padding:2mm 3mm;text-align:left;width:40%">รายการ</th>
                <th style="border:1px solid #dbeafe;padding:2mm 3mm;text-align:center">ค่าที่วัดได้</th>
              </tr>
            </thead>
            <tbody>
              ${tripItems.map((s, i) => `
                <tr style="${i % 2 === 0 ? 'background:#f9fafb' : 'background:#fff'}">
                  <td style="border:1px solid #e5e7eb;padding:2mm 3mm">${s.sub_item?.label || ''}</td>
                  <td style="border:1px solid #e5e7eb;padding:2mm 3mm;text-align:center;font-weight:bold">${s.measured_value || '-'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''

      const equipTable = showSubItems && equipItems.length > 0 ? `
        <div style="margin-bottom:6mm">
          <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:2mm">🔩 รายละเอียด (อุปกรณ์)</div>
          <table style="width:100%;border-collapse:collapse;font-size:9pt">
            <tbody>
              ${equipItems.slice(0,1).map(s => `
                <tr>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;background:#f9fafb;font-weight:bold;font-size:8.5pt;text-align:center">Main Circuit</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;background:#f9fafb;font-weight:bold;font-size:8.5pt;text-align:center">ชนิดสายไฟ</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;background:#f9fafb;font-weight:bold;font-size:8.5pt;text-align:center">ขนาดสายเฟส (Sq.mm.)</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;background:#f9fafb;font-weight:bold;font-size:8.5pt;text-align:center">ขนาดสายนิวทรัล (Sq.mm.)</td>
                </tr>
                <tr>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;text-align:center">${s.main_circuit || '-'}</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;text-align:center">${s.cable_type || '-'}</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;text-align:center">${s.phase_size || '-'}</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;text-align:center">${s.neutral_size || '-'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''

      const newTypeTables = showSubItems
        ? Object.entries(newTypeGroups).map(([type, items]) =>
            renderExtraDataPdf(items!, type as SubItemType)
          ).join('')
        : ''

      let imgHtml = ''
      if (showImages && r.images?.length) {
        const imgTags = await Promise.all(r.images.map(async img => {
          const b64 = await toBase64(img.image_url)
          return b64 ? `<img src="${b64}" style="width:55mm;height:45mm;object-fit:contain;border-radius:4px;border:1px solid #e5e7eb;margin:2mm;background:#f9fafb" />` : ''
        }))
        imgHtml = `<div style="margin-bottom:5mm">
          <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:3mm">รูปภาพ (${r.images.length} รูป)</div>
          <div style="display:flex;flex-wrap:wrap">${imgTags.join('')}</div>
        </div>`
      }

      return `
        <div style="padding:20mm;min-height:257mm;font-family:Sarabun,sans-serif;${idx < results.length - 1 ? 'page-break-after:always' : ''}">
          <div style="text-align:center;border-bottom:2px solid #1e3a8a;padding-bottom:8mm;margin-bottom:8mm">
            <div style="font-size:20pt;font-weight:bold;color:#1e3a8a;margin-bottom:2mm">${reportName}</div>
            <div style="font-size:11pt;color:#555;margin-bottom:1mm">สาขา: ${selected.branch_name}</div>
            <div style="font-size:10pt;color:#777">ผู้ประเมิน: ${selected.user?.name || '-'} | วันที่: ${dateStr}</div>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:5mm;margin-bottom:6mm">
            <div style="font-size:14pt;font-weight:bold;color:#1e3a8a;margin-bottom:2mm">หัวข้อที่ ${idx + 1}: ${r.topic?.title}</div>
            ${meta ? `<div style="display:flex;gap:6mm;margin-top:2mm">
              ${meta.equipment_no ? `<div style="font-size:10pt;color:#374151">🔧 หมายเลขอุปกรณ์: <strong>${meta.equipment_no}</strong></div>` : ''}
              ${meta.building ? `<div style="font-size:10pt;color:#374151">🏢 อาคาร: <strong>${meta.building}</strong></div>` : ''}
              ${meta.location ? `<div style="font-size:10pt;color:#374151">📍 สถานที่: <strong>${meta.location}</strong></div>` : ''}
            </div>` : ''}
          </div>
          ${equipTable}${tripTable}${checkboxTable}${newTypeTables}
          ${r.remark ? `<div style="margin-bottom:5mm">
            <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:2mm">หมายเหตุ</div>
            <div style="background:${r.remark === 'normal' ? '#dbeafe' : '#fee2e2'};border:1px solid ${r.remark === 'normal' ? '#93c5fd' : '#fecaca'};border-radius:6px;padding:4mm;font-size:11pt;color:${r.remark === 'normal' ? '#1e40af' : '#dc2626'}">
              ${r.remark === 'normal' ? 'สามารถใช้งานได้ตามปกติ' : 'ให้ทำการแก้ไขตามรายการที่ตรวจสอบ'}
            </div>
          </div>` : ''}
          ${showComments && r.comment ? `<div style="margin-bottom:5mm">
            <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:2mm">ความคิดเห็น</div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:4mm;font-size:11pt;line-height:1.7;color:#374151">${r.comment}</div>
          </div>` : ''}
          ${imgHtml}
          <div style="border-top:1px solid #e5e7eb;padding-top:3mm;font-size:9pt;color:#9ca3af;display:flex;justify-content:space-between;margin-top:10mm">
            <span>${reportName} — ${selected.branch_name}</span>
            <span>หน้า ${idx + 1} / ${results.length}</span>
          </div>
        </div>`
    }))

    toast.dismiss()
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;700&display=swap" rel="stylesheet">
      <style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family: Sarabun, sans-serif; } @media print { @page { size: A4 landscape; margin: 0; } }</style>
    </head><body>${pages.join('')}</body></html>`

    const win = window.open('', '_blank')
    if (!win) { toast.error('กรุณาอนุญาต popup ในเบราว์เซอร์'); return }
    win.document.write(html); win.document.close()
    win.onload = () => setTimeout(() => win.print(), 2000)
    toast.success('เปิดหน้าต่างพิมพ์แล้ว!')
  }

  // ============================================================
  // RENDER
  // ============================================================
  const dateStr = selected ? new Date(selected.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const toggleItems = [
    { label: 'แสดงหัวข้อย่อย', val: showSubItems, set: setShowSubItems },
    { label: 'แสดงความคิดเห็น', val: showComments, set: setShowComments },
    { label: 'แสดงรูปภาพ', val: showImages, set: setShowImages },
  ]

  return (
    <>
      <div className="grid grid-cols-3 gap-4" style={{ height: 'calc(100vh - 120px)' }}>

        {/* Col 1: รายการประเมิน */}
        <div className="col-span-1 bg-white rounded-2xl border border-gray-100 p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-900 mb-3">เลือกแบบประเมิน</h2>
          {assessments.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">ยังไม่มีรายการประเมิน</div>
          ) : (
            <div className="space-y-2">
              {assessments.map(a => (
                <div key={a.id} onClick={() => selectAssessment(a)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${selected?.id === a.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{a.branch_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{a.user?.name}</div>
                      <div className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('th-TH')}</div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={e => openEdit(a, e)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors" title="แก้ไข">✏️</button>
                      <button onClick={e => handleDelete(a, e)} className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-300 hover:text-red-500 transition-colors" title="ลบ">🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Col 2: ตั้งค่ารายงาน */}
        <div className="col-span-1 bg-white rounded-2xl border border-gray-100 p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-900 mb-3">ตั้งค่ารายงาน</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่อรายงาน</label>
              <input type="text" value={reportName} onChange={e => setReportName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400" />
            </div>
            {toggleItems.map(item => (
              <div key={item.label} className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-xs text-gray-600">{item.label}</span>
                <button onClick={() => item.set(!item.val)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${item.val ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${item.val ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <button onClick={handlePrint} disabled={!selected}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-xs font-medium disabled:opacity-40">
                🖨️ พิมพ์ / Export PDF
              </button>
              <button onClick={() => saveResultsToDb()}
                disabled={!selected || isSaving || (Object.keys(editingResults).length === 0 && Object.keys(editingSubResults).length === 0)}
                className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-all
                  ${saveStatus === 'saving' ? 'bg-blue-500 text-white' : saveStatus === 'saved' ? 'bg-green-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40'}`}>
                {saveStatus === 'saving' ? '💾 กำลัง...' : saveStatus === 'saved' ? '✓ บันทึก' : '💾 บันทึก'}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">กด "Save as PDF" ในหน้าต่างพิมพ์</p>
          </div>
        </div>

        {/* Col 3: Preview */}
        <div className="col-span-1 bg-white rounded-2xl border border-gray-100 p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Preview</h2>
          {selected ? (
            <div className="text-xs text-gray-500 space-y-1">
              <div>สาขา: <span className="font-medium text-gray-900">{selected.branch_name}</span></div>
              <div>ผู้ประเมิน: <span className="font-medium text-gray-900">{selected.user?.name}</span></div>
              <div>วันที่: <span className="font-medium text-gray-900">{dateStr}</span></div>
              <div className="space-y-2 mt-3">
                {results.map(r => {
                  const meta = getBranchMeta(r)
                  const checkboxItems = r.sub_results?.filter(s => s.sub_item?.type === 'checkbox') || []
                  const tripItems = r.sub_results?.filter(s => s.sub_item?.type === 'trip') || []
                  const equipItems = r.sub_results?.filter(s => s.sub_item?.type === 'equipment_detail') || []
                  const newTypeItems = r.sub_results?.filter(s => s.sub_item?.type && !OLD_TYPES.includes(s.sub_item.type)) || []

                  // group by type
                  const newTypeGroups: Partial<Record<SubItemType, SubItemResult[]>> = {}
                  newTypeItems.forEach(s => {
                    const t = s.sub_item?.type as SubItemType
                    if (!newTypeGroups[t]) newTypeGroups[t] = []
                    newTypeGroups[t]!.push(s)
                  })

                  return (
                    <div key={r.id} className="p-2 bg-gray-50 rounded-lg space-y-1">
                      <div className="font-medium text-gray-900">{r.topic?.title}</div>
                      {meta && (
                        <div className="flex gap-2 text-gray-400">
                          {meta.equipment_no && <span>🔧 {meta.equipment_no}</span>}
                          {meta.building && <span>🏢 {meta.building}</span>}
                          {meta.location && <span>📍 {meta.location}</span>}
                        </div>
                      )}

                      {/* equipment_detail */}
                      {showSubItems && equipItems.length > 0 && (
                        <div className="mt-1 border border-gray-200 rounded overflow-hidden">
                          <div className="bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">🔩 รายละเอียด (อุปกรณ์)</div>
                          {equipItems.map(s => (
                            <div key={s.id} className="grid grid-cols-4 px-2 py-0.5 border-t border-gray-100 text-xs gap-1 bg-gray-50">
                              {(['main_circuit','cable_type','phase_size','neutral_size'] as const).map(field => (
                                <input key={field} type="text"
                                  value={editingSubResults[s.id]?.[field] !== undefined ? (editingSubResults[s.id][field] ?? '') : (s[field] ?? '')}
                                  onChange={e => updateSubResultValue(s.id, field, e.target.value || null)}
                                  placeholder={field === 'main_circuit' ? 'Main' : field === 'cable_type' ? 'สายไฟ' : field === 'phase_size' ? 'เฟส' : 'นิวทรัล'}
                                  className="text-center px-1 py-0.5 border border-gray-200 rounded text-xs" />
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* trip */}
                      {showSubItems && tripItems.length > 0 && (
                        <div className="mt-1 border border-gray-200 rounded overflow-hidden">
                          <div className="grid grid-cols-2 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                            <div>⚡ รายละเอียด (แรงดันไฟฟ้า)</div><div>ค่าที่วัดได้</div>
                          </div>
                          {tripItems.map(s => (
                            <div key={s.id} className="grid grid-cols-2 px-2 py-1 border-t border-gray-100 text-xs gap-1">
                              <div className="text-gray-700">{s.sub_item?.label}</div>
                              <input type="text"
                                value={editingSubResults[s.id]?.measured_value !== undefined ? (editingSubResults[s.id].measured_value ?? '') : (s.measured_value ?? '')}
                                onChange={e => updateSubResultValue(s.id, 'measured_value', e.target.value || null)}
                                placeholder="กรอกค่า" className="border border-gray-200 rounded px-1 py-0.5 text-xs" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* checkbox */}
                      {showSubItems && checkboxItems.length > 0 && (
                        <div className="mt-1 border border-gray-200 rounded overflow-hidden">
                          <div className="grid grid-cols-5 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 gap-1">
                            <div className="col-span-2">รายการ</div><div>สถานะ</div><div>ค่าที่วัดได้</div><div>คำแนะนำ</div>
                          </div>
                          {checkboxItems.map(s => (
                            <div key={s.id} className="grid grid-cols-5 px-2 py-1 border-t border-gray-100 text-xs gap-1">
                              <div className="col-span-2 text-gray-700">{s.sub_item?.label}</div>
                              <select value={editingSubResults[s.id]?.status !== undefined ? (editingSubResults[s.id].status ?? 'normal') : (s.status ?? 'normal')}
                                onChange={e => updateSubResultValue(s.id, 'status', e.target.value === 'normal' ? 'normal' : 'abnormal')}
                                className="border border-gray-200 rounded px-1 py-0.5 text-xs">
                                <option value="normal">ปกติ</option>
                                <option value="abnormal">ไม่ปกติ</option>
                              </select>
                              <input type="text"
                                value={editingSubResults[s.id]?.measured_value !== undefined ? (editingSubResults[s.id].measured_value ?? '') : (s.measured_value ?? '')}
                                onChange={e => updateSubResultValue(s.id, 'measured_value', e.target.value || null)}
                                placeholder="-" className="border border-gray-200 rounded px-1 py-0.5 text-xs" />
                              <input type="text"
                                value={editingSubResults[s.id]?.note !== undefined ? (editingSubResults[s.id].note ?? '') : (s.note ?? '')}
                                onChange={e => updateSubResultValue(s.id, 'note', e.target.value || null)}
                                placeholder="แนะนำ" className="border border-gray-200 rounded px-1 py-0.5 text-xs" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* new types — horizontal table grouped by type */}
                      {showSubItems && Object.entries(newTypeGroups).map(([type, items]) => (
                        <ExtraDataPreviewTable key={type} items={items!} type={type as SubItemType} />
                      ))}

                      {/* remark + comment */}
                      <div className="space-y-1 mt-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600 min-w-fit">หมายเหตุ:</label>
                          <select
                            value={editingResults[r.id]?.remark !== undefined ? (editingResults[r.id].remark ?? '') : (r.remark ?? '')}
                            onChange={e => updateResultValue(r.id, 'remark', e.target.value || null)}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400">
                            <option value="">- ไม่ระบุ -</option>
                            <option value="normal">✓ สามารถใช้งานได้ตามปกติ</option>
                            <option value="needs_fix">✗ ให้ทำการแก้ไขตามรายการที่ตรวจสอบ</option>
                          </select>
                        </div>
                        <textarea
                          value={editingResults[r.id]?.comment !== undefined ? (editingResults[r.id].comment ?? '') : (r.comment ?? '')}
                          onChange={e => updateResultValue(r.id, 'comment', e.target.value || null)}
                          placeholder="บันทึกความเห็น..."
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400 resize-none" rows={2} />
                      </div>

                      {showImages && r.images && r.images.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {r.images.map(img => <img key={img.id} src={img.image_url} alt="" className="w-10 h-10 rounded object-cover" />)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-gray-400">เลือกแบบประเมินเพื่อดู Preview</div>
          )}
        </div>
      </div>

      {/* MODAL: แก้ไขแบบประเมิน */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-sm font-medium text-gray-900 mb-4">แก้ไขแบบประเมิน</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ชื่อสาขา</label>
                <input type="text" value={editForm.branch_name} onChange={e => setEditForm(p => ({ ...p, branch_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">วันที่ประเมิน</label>
                <input type="date" value={editForm.inspect_date} onChange={e => setEditForm(p => ({ ...p, inspect_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowEditModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600">ยกเลิก</button>
              <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}