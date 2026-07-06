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

interface SubItem {
  id: string
  label: string
  type: SubItemType
  sort_order: number
  extra_data?: Record<string, string> | null
}

interface BranchConfig {
  branch_id: string
  building: string | null
  equipment_no: string | null
  location: string | null
}

interface Topic {
  id: string
  title: string
  description: string | null
  configs?: BranchConfig[]
  sub_items?: SubItem[]
}

interface Branch { id: string; name: string }

type SubValues = Record<string, Record<string, {
  status?: 'normal' | 'abnormal'
  standard_value?: string
  measured_value?: string
  recommendation?: string
}>>

type EquipmentValues = Record<string, {
  main_circuit?: string
  cable_type?: string
  phase_size?: string
  neutral_size?: string
}>

// extra values สำหรับ type ใหม่ — topicId → subItemId → fieldKey → value
type ExtraValues = Record<string, Record<string, Record<string, string>>>

// ============================================================
// HELPERS: render ฟอร์มตาม type
// ============================================================
function CheckboxStatusField({
  label, fieldKey, value, onChange, passLabel = 'ปกติ', failLabel = 'ไม่ปกติ',
}: {
  label: string; fieldKey: string; value: string; onChange: (v: string) => void
  passLabel?: string; failLabel?: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-700 flex-1 pr-2">{label}</span>
      <div className="flex gap-2 flex-shrink-0">
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="radio" name={fieldKey} checked={value === 'normal' || value === ''}
            onChange={() => onChange('normal')} className="accent-blue-600" />
          <span className="text-xs text-green-700">{passLabel}</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="radio" name={fieldKey} checked={value === 'abnormal'}
            onChange={() => onChange('abnormal')} className="accent-red-500" />
          <span className="text-xs text-red-600">{failLabel}</span>
        </label>
      </div>
    </div>
  )
}

function MeasuredField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-700 flex-1">{label}</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder="กรอกค่า"
        className="w-28 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
    </div>
  )
}

function BoolCheckField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 cursor-pointer">
      <input type="checkbox" checked={value === 'true'} onChange={e => onChange(e.target.checked ? 'true' : 'false')}
        className="w-4 h-4 accent-blue-600" />
      <span className="text-xs text-gray-700">{label}</span>
    </label>
  )
}

// ============================================================
// COMPONENT
// ============================================================
export default function AssessmentPage() {
  const [step, setStep] = useState(1)
  const [branches, setBranches] = useState<Branch[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [branchId, setBranchId] = useState('')
  const [inspectorName, setInspectorName] = useState('')
  const [inspectDate, setInspectDate] = useState(new Date().toISOString().split('T')[0])
  const [inspectTime, setInspectTime] = useState('08:30')
  const [comments, setComments] = useState<Record<string, string>>({})
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [subValues, setSubValues] = useState<SubValues>({})
  const [equipValues, setEquipValues] = useState<EquipmentValues>({})
  const [extraValues, setExtraValues] = useState<ExtraValues>({})
  const [images, setImages] = useState<Record<string, File[]>>({})
  const [previews, setPreviews] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const supabase = createClient()

  // ============================================================
  // FETCH
  // ============================================================
  useEffect(() => {
    const init = async () => {
      const { data: branchData } = await supabase.from('branches').select('*').eq('active', true).order('name')
      setBranches(branchData || [])
      if (branchData && branchData.length > 0) setBranchId(branchData[0].id)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('users').select('name').eq('id', user.id).single()
        if (data) setInspectorName(data.name)

        const { data: latestDraft } = await supabase
          .from('assessments')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()

        if (latestDraft && latestDraft.form_data) {
          try {
            const formData = JSON.parse(latestDraft.form_data)
            setDraftId(latestDraft.id)
            setBranchId(latestDraft.branch_id || branchData?.[0]?.id || '')
            setInspectorName(formData.inspectorName || data?.name || '')
            setInspectDate(formData.inspectDate || new Date().toISOString().split('T')[0])
            setInspectTime(formData.inspectTime || '08:30')
            setComments(formData.comments || {})
            setRemarks(formData.remarks || {})
            setSubValues(formData.subValues || {})
            setEquipValues(formData.equipValues || {})
            setExtraValues(formData.extraValues || {})
            if (formData.selectedTopics) setSelected(new Set(formData.selectedTopics))
            toast.success('โหลด Draft ก่อนหน้าแล้ว ✓')
          } catch (e) { console.error('Error parsing draft:', e) }
        }
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!branchId) return
    const fetchTopics = async () => {
      const { data } = await supabase
        .from('assessment_topics')
        .select('*, configs:topic_branch_config(*), sub_items:topic_sub_items(*)')
        .eq('active', true)
        .order('sort_order')
      const filtered = (data || []).filter((t: Topic) => t.configs?.some(c => c.branch_id === branchId))
      setTopics(filtered)
      setSelected(prev => prev.size > 0 ? prev : new Set(filtered.map(t => t.id)))
    }
    fetchTopics()
  }, [branchId])

  // ============================================================
  // HELPERS
  // ============================================================
  const getBranchConfig = (t: Topic): BranchConfig | undefined =>
    t.configs?.find(c => c.branch_id === branchId)

  const toggleTopic = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const updateSubValue = (topicId: string, subId: string, field: string, value: string) => {
    setSubValues(prev => ({
      ...prev,
      [topicId]: { ...prev[topicId], [subId]: { ...prev[topicId]?.[subId], [field]: value } },
    }))
  }

  const updateEquipValue = (topicId: string, field: keyof EquipmentValues[string], value: string) => {
    setEquipValues(prev => ({ ...prev, [topicId]: { ...prev[topicId], [field]: value } }))
  }

  // update extra values สำหรับ type ใหม่
  const updateExtra = (topicId: string, subId: string, field: string, value: string) => {
    setExtraValues(prev => ({
      ...prev,
      [topicId]: {
        ...prev[topicId],
        [subId]: { ...prev[topicId]?.[subId], [field]: value },
      },
    }))
  }

  const getExtra = (topicId: string, subId: string, field: string): string =>
    extraValues[topicId]?.[subId]?.[field] || ''

  const handleImageChange = (topicId: string, files: FileList | null) => {
    if (!files) return
    const newFiles = Array.from(files).slice(0, 5)
    setImages(prev => ({ ...prev, [topicId]: [...(prev[topicId] || []), ...newFiles].slice(0, 5) }))
    setPreviews(prev => ({
      ...prev,
      [topicId]: [...(prev[topicId] || []), ...newFiles.map(f => URL.createObjectURL(f))].slice(0, 5),
    }))
  }

  const removeImage = (topicId: string, index: number) => {
    setImages(prev => ({ ...prev, [topicId]: prev[topicId].filter((_, i) => i !== index) }))
    setPreviews(prev => ({ ...prev, [topicId]: prev[topicId].filter((_, i) => i !== index) }))
  }

  const resetForm = () => {
    setStep(1); setSelected(new Set()); setComments({}); setRemarks({})
    setSubValues({}); setEquipValues({}); setExtraValues({})
    setImages({}); setPreviews({})
  }

  // ============================================================
  // DRAFT SAVE
  // ============================================================
  const saveDraft = async (isDraft = true) => {
    if (!branchId) { toast.error('กรุณาเลือกสาขา'); return }
    if (selected.size === 0) { toast.error('กรุณาเลือกหัวข้ออย่างน้อย 1 หัวข้อ'); return }
    setSaveStatus('saving'); setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้')
      const branch = branches.find(b => b.id === branchId)
      const formData = JSON.stringify({
        inspectorName, inspectDate, inspectTime,
        selectedTopics: Array.from(selected),
        comments, remarks, subValues, equipValues, extraValues,
      })
      if (!draftId) {
        const { data: newDraft, error: ae } = await supabase.from('assessments').insert({
          user_id: user.id, branch_name: branch?.name, branch_id: branchId,
          status: isDraft ? 'draft' : 'submitted', form_data: formData,
        }).select().single()
        if (ae) throw ae
        setDraftId(newDraft.id)
      } else {
        const { error: ue } = await supabase.from('assessments').update({
          branch_name: branch?.name, form_data: formData, updated_at: new Date().toISOString(),
        }).eq('id', draftId)
        if (ue) throw ue
      }
      setSaveStatus('saved'); toast.success('บันทึก Draft สำเร็จ')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err: any) {
      setSaveStatus('idle'); toast.error('บันทึก Draft ไม่สำเร็จ: ' + (err.message || 'เกิดข้อผิดพลาด'))
    } finally { setIsSaving(false) }
  }

  useEffect(() => {
    if (step !== 2 || !branchId || selected.size === 0) return
    const interval = setInterval(() => { saveDraft(true) }, 30000)
    return () => clearInterval(interval)
  }, [step, branchId, selected, inspectorName, inspectDate, inspectTime, comments, remarks, subValues, equipValues, extraValues])

  // ============================================================
  // SUBMIT
  // ============================================================
  const handleSubmit = async () => {
    if (!branchId) { toast.error('กรุณาเลือกสาขา'); return }
    if (selected.size === 0) { toast.error('กรุณาเลือกหัวข้ออย่างน้อย 1 หัวข้อ'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้')
      const branch = branches.find(b => b.id === branchId)

      let assessment_id = draftId
      if (draftId) {
        const { error: ue } = await supabase.from('assessments').update({ status: 'submitted' }).eq('id', draftId)
        if (ue) throw ue
      } else {
        const { data: assessment, error: ae } = await supabase.from('assessments')
          .insert({ user_id: user.id, branch_name: branch?.name, branch_id: branchId, status: 'submitted' })
          .select().single()
        if (ae) throw ae
        assessment_id = assessment.id
      }

      for (const topicId of selected) {
        const { data: result, error: re } = await supabase.from('assessment_results').insert({
          assessment_id, topic_id: topicId,
          remark: remarks[topicId] || null,
          comment: comments[topicId] || null,
        }).select().single()
        if (re) throw re

        const topic = topics.find(t => t.id === topicId)
        const subItems = topic?.sub_items || []

        for (const sub of subItems) {
          if (sub.type === 'checkbox') {
            const vals = subValues[topicId]?.[sub.id]
            await supabase.from('result_sub_items').insert({
              result_id: result.id, sub_item_id: sub.id,
              status: vals?.status || 'normal',
              standard_value: vals?.standard_value || null,
              measured_value: vals?.measured_value || null,
              note: vals?.recommendation || null,
            })
          } else if (sub.type === 'trip') {
            const vals = subValues[topicId]?.[sub.id]
            await supabase.from('result_sub_items').insert({
              result_id: result.id, sub_item_id: sub.id,
              measured_value: vals?.measured_value || null,
            })
          } else if (sub.type === 'equipment_detail') {
            const ev = equipValues[topicId]
            await supabase.from('result_sub_items').insert({
              result_id: result.id, sub_item_id: sub.id,
              main_circuit: ev?.main_circuit || null,
              cable_type: ev?.cable_type || null,
              phase_size: ev?.phase_size || null,
              neutral_size: ev?.neutral_size || null,
            })
          } else {
            // type ใหม่ทั้งหมด — เก็บใน extra_data
            const extra = extraValues[topicId]?.[sub.id] || {}
            await supabase.from('result_sub_items').insert({
              result_id: result.id, sub_item_id: sub.id,
              extra_data: Object.keys(extra).length > 0 ? extra : null,
            })
          }
        }

        for (const file of images[topicId] || []) {
          const path = `${user.id}/${assessment_id}/${result.id}/${Date.now()}-${file.name}`
          const { error: ue } = await supabase.storage.from('assessment-images').upload(path, file)
          if (ue) continue
          const { data: { publicUrl } } = supabase.storage.from('assessment-images').getPublicUrl(path)
          await supabase.from('assessment_images').insert({ result_id: result.id, image_url: publicUrl, file_name: file.name })
        }
      }

      toast.success('ส่งแบบประเมินสำเร็จ!')
      resetForm(); setDraftId(null)
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด')
    } finally { setLoading(false) }
  }

  const selectedTopics = topics.filter(t => selected.has(t.id))
  const selectedBranch = branches.find(b => b.id === branchId)

  // ============================================================
  // RENDER SUB-ITEMS ตาม type
  // ============================================================
  const renderSubItem = (t: Topic, sub: SubItem) => {
    const tid = t.id
    const sid = sub.id

    if (sub.type === 'door') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">🚪 เลือกประเภทประตู</div>
        <BoolCheckField label="ประตูสำนักงาน" value={getExtra(tid, sid, 'office_door')} onChange={v => updateExtra(tid, sid, 'office_door', v)} />
        <BoolCheckField label="ประตูหนีไฟ" value={getExtra(tid, sid, 'fire_door')} onChange={v => updateExtra(tid, sid, 'fire_door', v)} />
      </div>
    )

    if (sub.type === 'door_inspection') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">🚪 การตรวจประตู — {sub.label}</div>
        <CheckboxStatusField label="ตรวจสอบฐานล่างประตู" fieldKey={`${sid}-bottom`} value={getExtra(tid, sid, 'bottom_base_check')} onChange={v => updateExtra(tid, sid, 'bottom_base_check', v)} />
        <CheckboxStatusField label="ตรวจสอบเสาข้างประตู" fieldKey={`${sid}-post`} value={getExtra(tid, sid, 'side_post_check')} onChange={v => updateExtra(tid, sid, 'side_post_check', v)} />
        <CheckboxStatusField label="ตรวจสอบบานพับประตู" fieldKey={`${sid}-hinge`} value={getExtra(tid, sid, 'hinge_check')} onChange={v => updateExtra(tid, sid, 'hinge_check', v)} />
        <CheckboxStatusField label="ตรวจสอบโช๊คประตูหนีไฟ" fieldKey={`${sid}-closer`} value={getExtra(tid, sid, 'door_closer_check')} onChange={v => updateExtra(tid, sid, 'door_closer_check', v)} />
        <CheckboxStatusField label="ตรวจสอบคานผลักประตู" fieldKey={`${sid}-bar`} value={getExtra(tid, sid, 'push_bar_check')} onChange={v => updateExtra(tid, sid, 'push_bar_check', v)} />
        <CheckboxStatusField label="ทำความสะอาด" fieldKey={`${sid}-clean`} value={getExtra(tid, sid, 'cleaning_check')} onChange={v => updateExtra(tid, sid, 'cleaning_check', v)} passLabel="ผ่าน" failLabel="ไม่ผ่าน" />
        <div className="mt-2">
          <label className="text-xs text-gray-600">คำแนะนำและการแก้ไข</label>
          <textarea value={getExtra(tid, sid, 'recommendation')} onChange={e => updateExtra(tid, sid, 'recommendation', e.target.value)}
            rows={2} placeholder="คำแนะนำ..." className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-none" />
        </div>
      </div>
    )

    if (sub.type === 'socket_inspection') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">🔌 การตรวจเต้ารับไฟฟ้า — {sub.label}</div>
        <CheckboxStatusField label="ตรวจสอบสภาพเต้ารับ" fieldKey={`${sid}-sc`} value={getExtra(tid, sid, 'socket_condition_check')} onChange={v => updateExtra(tid, sid, 'socket_condition_check', v)} />
        <CheckboxStatusField label="ตรวจสอบสภาพบล็อคยึดเต้ารับ" fieldKey={`${sid}-bf`} value={getExtra(tid, sid, 'box_fixing_check')} onChange={v => updateExtra(tid, sid, 'box_fixing_check', v)} />
        <CheckboxStatusField label="ตรวจสอบสภาพสายไฟก่อนเข้าเต้ารับ" fieldKey={`${sid}-ws`} value={getExtra(tid, sid, 'wire_before_socket_check')} onChange={v => updateExtra(tid, sid, 'wire_before_socket_check', v)} />
        <CheckboxStatusField label="ตรวจสอบจุดเชื่อมต่อบล็อคและท่อร้อยสาย" fieldKey={`${sid}-cj`} value={getExtra(tid, sid, 'conduit_joint_check')} onChange={v => updateExtra(tid, sid, 'conduit_joint_check', v)} />
        <CheckboxStatusField label="ตรวจสอบสายดิน" fieldKey={`${sid}-gw`} value={getExtra(tid, sid, 'ground_wire_check')} onChange={v => updateExtra(tid, sid, 'ground_wire_check', v)} />
        <CheckboxStatusField label="ทำความสะอาด" fieldKey={`${sid}-cl`} value={getExtra(tid, sid, 'cleaning_check')} onChange={v => updateExtra(tid, sid, 'cleaning_check', v)} passLabel="ผ่าน" failLabel="ไม่ผ่าน" />
        <div className="mt-2">
          <label className="text-xs text-gray-600">คำแนะนำและการแก้ไข</label>
          <textarea value={getExtra(tid, sid, 'recommendation')} onChange={e => updateExtra(tid, sid, 'recommendation', e.target.value)}
            rows={2} placeholder="คำแนะนำ..." className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-none" />
        </div>
      </div>
    )

    if (sub.type === 'sanitary_inspection') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">🚿 การตรวจสุขภัณฑ์ — {sub.label}</div>
        <CheckboxStatusField label="ตรวจสอบสภาพสุขภัณฑ์" fieldKey={`${sid}-san`} value={getExtra(tid, sid, 'sanitary_condition_check')} onChange={v => updateExtra(tid, sid, 'sanitary_condition_check', v)} />
        <CheckboxStatusField label="ฟลัชวาล์ว" fieldKey={`${sid}-fv`} value={getExtra(tid, sid, 'flush_valve_check')} onChange={v => updateExtra(tid, sid, 'flush_valve_check', v)} />
        <CheckboxStatusField label="ข้อต่อท่อน้ำดี" fieldKey={`${sid}-ij`} value={getExtra(tid, sid, 'inlet_joint_check')} onChange={v => updateExtra(tid, sid, 'inlet_joint_check', v)} />
        <CheckboxStatusField label="รอยรั่วซึมและยางกันซึม" fieldKey={`${sid}-lw`} value={getExtra(tid, sid, 'leakage_and_washer_check')} onChange={v => updateExtra(tid, sid, 'leakage_and_washer_check', v)} />
        <CheckboxStatusField label="การทำงานของลูกลอย" fieldKey={`${sid}-fv2`} value={getExtra(tid, sid, 'float_valve_check')} onChange={v => updateExtra(tid, sid, 'float_valve_check', v)} />
        <CheckboxStatusField label="ถังเก็บน้ำและยาแนว" fieldKey={`${sid}-wt`} value={getExtra(tid, sid, 'water_tank_grout_check')} onChange={v => updateExtra(tid, sid, 'water_tank_grout_check', v)} />
        <CheckboxStatusField label="การไหลของน้ำในระบบ" fieldKey={`${sid}-wf`} value={getExtra(tid, sid, 'water_flow_check')} onChange={v => updateExtra(tid, sid, 'water_flow_check', v)} />
        <CheckboxStatusField label="กลิ่นบริเวณรอบๆ" fieldKey={`${sid}-od`} value={getExtra(tid, sid, 'odor_check')} onChange={v => updateExtra(tid, sid, 'odor_check', v)} passLabel="มีกลิ่น" failLabel="ไม่มีกลิ่น" />
        <CheckboxStatusField label="การยึดและทดสอบความแข็งแรง" fieldKey={`${sid}-st`} value={getExtra(tid, sid, 'stability_test_check')} onChange={v => updateExtra(tid, sid, 'stability_test_check', v)} />
        <div className="mt-2">
          <label className="text-xs text-gray-600">คำแนะนำและการแก้ไข</label>
          <textarea value={getExtra(tid, sid, 'recommendation')} onChange={e => updateExtra(tid, sid, 'recommendation', e.target.value)}
            rows={2} placeholder="คำแนะนำ..." className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-none" />
        </div>
      </div>
    )

    if (sub.type === 'emergency_inspection') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">🔦 การตรวจ Emergency — {sub.label}</div>
        <div className="bg-blue-50 rounded-lg p-2 mb-2">
          <div className="text-xs font-medium text-blue-600 mb-1">ข้อมูล Setup</div>
          <div className="text-xs text-gray-600">อุปกรณ์: <span className="font-medium text-gray-900">{sub.extra_data?.['อุปกรณ์'] || '-'}</span></div>
        </div>
        <MeasuredField label="แหล่งจ่ายไฟ AC Emergency Light (220V)" value={getExtra(tid, sid, 'ac_power_voltage')} onChange={v => updateExtra(tid, sid, 'ac_power_voltage', v)} />
        <CheckboxStatusField label="สภาวะการ Charging (หลอดดับ/กระพริบ)" fieldKey={`${sid}-cs`} value={getExtra(tid, sid, 'dc_charging_status_check')} onChange={v => updateExtra(tid, sid, 'dc_charging_status_check', v)} />
        <CheckboxStatusField label="ค่าที่ Charging ได้ (หลอดแสดง Full)" fieldKey={`${sid}-cf`} value={getExtra(tid, sid, 'dc_charging_full_check')} onChange={v => updateExtra(tid, sid, 'dc_charging_full_check', v)} />
        <CheckboxStatusField label="Test Battery ไปหลอด 5 วินาที (หลอดสว่าง)" fieldKey={`${sid}-bt`} value={getExtra(tid, sid, 'battery_test_5s_check')} onChange={v => updateExtra(tid, sid, 'battery_test_5s_check', v)} />
        <CheckboxStatusField label="สภาพการชำรุด/LED" fieldKey={`${sid}-led`} value={getExtra(tid, sid, 'led_condition_check')} onChange={v => updateExtra(tid, sid, 'led_condition_check', v)} />
        <CheckboxStatusField label="สภาพการชำรุด/ฟิวส์" fieldKey={`${sid}-fuse`} value={getExtra(tid, sid, 'fuse_condition_check')} onChange={v => updateExtra(tid, sid, 'fuse_condition_check', v)} />
        <CheckboxStatusField label="สภาพการชำรุด/หลอดไฟ" fieldKey={`${sid}-lamp`} value={getExtra(tid, sid, 'lamp_condition_check')} onChange={v => updateExtra(tid, sid, 'lamp_condition_check', v)} />
        <CheckboxStatusField label="ทดสอบการเปิดต่อเนื่อง 90 นาที (หลอดสว่าง)" fieldKey={`${sid}-90`} value={getExtra(tid, sid, 'test_90mins_check')} onChange={v => updateExtra(tid, sid, 'test_90mins_check', v)} />
        <div className="mt-2">
          <label className="text-xs text-gray-600">คำแนะนำและแนวทางแก้ไข</label>
          <textarea value={getExtra(tid, sid, 'recommendation')} onChange={e => updateExtra(tid, sid, 'recommendation', e.target.value)}
            rows={2} placeholder="คำแนะนำ..." className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-none" />
        </div>
      </div>
    )

    if (sub.type === 'lighting_inspection') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">💡 การตรวจแสงสว่าง — {sub.label}</div>
        <div className="bg-blue-50 rounded-lg p-2 mb-2">
          <div className="text-xs font-medium text-blue-600 mb-1">ข้อมูล Setup</div>
          <div className="text-xs text-gray-600">ชนิดโคมไฟ: <span className="font-medium text-gray-900">{sub.extra_data?.['ชนิดโคมไฟ'] || '-'}</span></div>
        </div>
        <CheckboxStatusField label="สภาพความสมบูรณ์ของโคมไฟฟ้า" fieldKey={`${sid}-fc`} value={getExtra(tid, sid, 'fixture_condition_check')} onChange={v => updateExtra(tid, sid, 'fixture_condition_check', v)} />
        <CheckboxStatusField label="ขั้วรับหลอด" fieldKey={`${sid}-sk`} value={getExtra(tid, sid, 'socket_condition_check')} onChange={v => updateExtra(tid, sid, 'socket_condition_check', v)} />
        <CheckboxStatusField label="สภาพหลอดไฟฟ้า" fieldKey={`${sid}-lc`} value={getExtra(tid, sid, 'lamp_condition_check')} onChange={v => updateExtra(tid, sid, 'lamp_condition_check', v)} />
        <CheckboxStatusField label="บล็อคและสวิตช์ควบคุมโคมไฟ" fieldKey={`${sid}-sw`} value={getExtra(tid, sid, 'switch_control_check')} onChange={v => updateExtra(tid, sid, 'switch_control_check', v)} />
        <CheckboxStatusField label="การติดตั้งโคมไฟ" fieldKey={`${sid}-ins`} value={getExtra(tid, sid, 'installation_check')} onChange={v => updateExtra(tid, sid, 'installation_check', v)} />
        <CheckboxStatusField label="ค่าความสว่างภายในห้อง" fieldKey={`${sid}-lux`} value={getExtra(tid, sid, 'lux_level_check')} onChange={v => updateExtra(tid, sid, 'lux_level_check', v)} />
        <div className="mt-2">
          <label className="text-xs text-gray-600">คำแนะนำและการแก้ไข</label>
          <textarea value={getExtra(tid, sid, 'recommendation')} onChange={e => updateExtra(tid, sid, 'recommendation', e.target.value)}
            rows={2} placeholder="คำแนะนำ..." className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-none" />
        </div>
      </div>
    )

    if (sub.type === 'fan') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">🌀 เลือกประเภทพัดลม</div>
        <BoolCheckField label="พัดลมโคจร" value={getExtra(tid, sid, 'orbit_fan')} onChange={v => updateExtra(tid, sid, 'orbit_fan', v)} />
        <BoolCheckField label="พัดลมติดผนัง" value={getExtra(tid, sid, 'wall_fan')} onChange={v => updateExtra(tid, sid, 'wall_fan', v)} />
        <BoolCheckField label="พัดลมระบายอากาศ" value={getExtra(tid, sid, 'exhaust_fan')} onChange={v => updateExtra(tid, sid, 'exhaust_fan', v)} />
      </div>
    )

    if (sub.type === 'fan_inspection') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">🌀 การตรวจพัดลม — {sub.label}</div>
        <div className="bg-blue-50 rounded-lg p-2 mb-2">
          <div className="text-xs font-medium text-blue-600 mb-1">ข้อมูล Setup</div>
          <div className="text-xs text-gray-600">อุปกรณ์: <span className="font-medium text-gray-900">{sub.extra_data?.['อุปกรณ์'] || '-'}</span></div>
          <div className="text-xs text-gray-600">หมายเลขเครื่อง: <span className="font-medium text-gray-900">{sub.extra_data?.['หมายเลขเครื่อง'] || '-'}</span></div>
        </div>
        <MeasuredField label="กระแสมอเตอร์ (A)" value={getExtra(tid, sid, 'motor_current')} onChange={v => updateExtra(tid, sid, 'motor_current', v)} />
        <MeasuredField label="แรงดันไฟฟ้า (220/380) (V)" value={getExtra(tid, sid, 'voltage')} onChange={v => updateExtra(tid, sid, 'voltage', v)} />
        <CheckboxStatusField label="การทำงานของพัดลม" fieldKey={`${sid}-fo`} value={getExtra(tid, sid, 'fan_operation_check')} onChange={v => updateExtra(tid, sid, 'fan_operation_check', v)} />
        <CheckboxStatusField label="สภาพสายไฟและใบพัดลม" fieldKey={`${sid}-wb`} value={getExtra(tid, sid, 'wiring_and_blade_check')} onChange={v => updateExtra(tid, sid, 'wiring_and_blade_check', v)} />
        <CheckboxStatusField label="การสั่นสะเทือนของมอเตอร์" fieldKey={`${sid}-mv`} value={getExtra(tid, sid, 'motor_vibration_check')} onChange={v => updateExtra(tid, sid, 'motor_vibration_check', v)} />
        <CheckboxStatusField label="ไขน็อตให้แน่นและทำความสะอาด" fieldKey={`${sid}-tc`} value={getExtra(tid, sid, 'tightening_and_cleaning_check')} onChange={v => updateExtra(tid, sid, 'tightening_and_cleaning_check', v)} passLabel="ผ่าน" failLabel="ไม่ผ่าน" />
        <div className="mt-2">
          <label className="text-xs text-gray-600">คำแนะนำและการแก้ไข</label>
          <textarea value={getExtra(tid, sid, 'recommendation')} onChange={e => updateExtra(tid, sid, 'recommendation', e.target.value)}
            rows={2} placeholder="คำแนะนำ..." className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-none" />
        </div>
      </div>
    )

    if (sub.type === 'fire_extinguisher_inspection') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">🧯 การตรวจถังดับเพลิง — {sub.label}</div>
        <div className="bg-blue-50 rounded-lg p-2 mb-2">
          <div className="text-xs font-medium text-blue-600 mb-1">ข้อมูล Setup</div>
          <div className="text-xs text-gray-600">หมายเลขถัง: <span className="font-medium text-gray-900">{sub.extra_data?.['หมายเลขถัง'] || '-'}</span></div>
          <div className="text-xs text-gray-600">ประเภท: <span className="font-medium text-gray-900">{sub.extra_data?.['ประเภท'] || '-'}</span></div>
          <div className="text-xs text-gray-600">ขนาด: <span className="font-medium text-gray-900">{sub.extra_data?.['ขนาด'] || '-'}</span></div>
        </div>
        <CheckboxStatusField label="สายฉีด" fieldKey={`${sid}-hose`} value={getExtra(tid, sid, 'hose_check')} onChange={v => updateExtra(tid, sid, 'hose_check', v)} />
        <CheckboxStatusField label="คันบังคับ" fieldKey={`${sid}-lev`} value={getExtra(tid, sid, 'lever_check')} onChange={v => updateExtra(tid, sid, 'lever_check', v)} />
        <CheckboxStatusField label="ตัวถัง" fieldKey={`${sid}-cyl`} value={getExtra(tid, sid, 'cylinder_check')} onChange={v => updateExtra(tid, sid, 'cylinder_check', v)} />
        <CheckboxStatusField label="เกจความดัน/น้ำหนัก" fieldKey={`${sid}-pg`} value={getExtra(tid, sid, 'pressure_gauge_weight_check')} onChange={v => updateExtra(tid, sid, 'pressure_gauge_weight_check', v)} />
        <CheckboxStatusField label="สิ่งกีดขวาง" fieldKey={`${sid}-obs`} value={getExtra(tid, sid, 'obstruction_check')} onChange={v => updateExtra(tid, sid, 'obstruction_check', v)} />
        <div className="mt-2">
          <label className="text-xs text-gray-600">คำแนะนำและการแก้ไข</label>
          <textarea value={getExtra(tid, sid, 'recommendation')} onChange={e => updateExtra(tid, sid, 'recommendation', e.target.value)}
            rows={2} placeholder="คำแนะนำ..." className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-none" />
        </div>
      </div>
    )

    if (sub.type === 'exit_sign') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">🚨 เลือกประเภทป้าย</div>
        <BoolCheckField label="ตู้ไฟแสงสว่างฉุกเฉิน" value={getExtra(tid, sid, 'emergency_light_box')} onChange={v => updateExtra(tid, sid, 'emergency_light_box', v)} />
        <BoolCheckField label="ป้ายบอกทางหนีไฟ" value={getExtra(tid, sid, 'exit_sign_board')} onChange={v => updateExtra(tid, sid, 'exit_sign_board', v)} />
      </div>
    )

    if (sub.type === 'exit_sign_inspection') return (
      <div key={sid} className="border border-gray-100 rounded-xl p-3 mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">🚨 การตรวจ Emergency/Exit Sign — {sub.label}</div>
        <div className="bg-blue-50 rounded-lg p-2 mb-2">
          <div className="text-xs font-medium text-blue-600 mb-1">ข้อมูล Setup</div>
          <div className="text-xs text-gray-600">อุปกรณ์: <span className="font-medium text-gray-900">{sub.extra_data?.['อุปกรณ์'] || '-'}</span></div>
        </div>
        <MeasuredField label="แหล่งจ่ายไฟ AC Emergency Light (220V)" value={getExtra(tid, sid, 'ac_power_voltage')} onChange={v => updateExtra(tid, sid, 'ac_power_voltage', v)} />
        <CheckboxStatusField label="สภาวะการ Charging (หลอดดับ/กระพริบ)" fieldKey={`${sid}-cs`} value={getExtra(tid, sid, 'charging_status_check')} onChange={v => updateExtra(tid, sid, 'charging_status_check', v)} />
        <CheckboxStatusField label="ค่าที่ Charging ได้ (หลอดแสดง Full)" fieldKey={`${sid}-cf`} value={getExtra(tid, sid, 'charging_full_check')} onChange={v => updateExtra(tid, sid, 'charging_full_check', v)} />
        <CheckboxStatusField label="Test Battery ไปหลอด 5 วินาที (หลอดสว่าง)" fieldKey={`${sid}-bt`} value={getExtra(tid, sid, 'battery_test_5s_check')} onChange={v => updateExtra(tid, sid, 'battery_test_5s_check', v)} />
        <CheckboxStatusField label="LED" fieldKey={`${sid}-led`} value={getExtra(tid, sid, 'led_check')} onChange={v => updateExtra(tid, sid, 'led_check', v)} />
        <CheckboxStatusField label="ฟิวส์" fieldKey={`${sid}-fuse`} value={getExtra(tid, sid, 'fuse_check')} onChange={v => updateExtra(tid, sid, 'fuse_check', v)} />
        <CheckboxStatusField label="หลอดไฟ" fieldKey={`${sid}-lamp`} value={getExtra(tid, sid, 'lamp_check')} onChange={v => updateExtra(tid, sid, 'lamp_check', v)} />
        <CheckboxStatusField label="ทดสอบการเปิดต่อเนื่อง 90 นาที (หลอดสว่าง)" fieldKey={`${sid}-90`} value={getExtra(tid, sid, 'test_90mins_check')} onChange={v => updateExtra(tid, sid, 'test_90mins_check', v)} />
        <div className="mt-2">
          <label className="text-xs text-gray-600">คำแนะนำและการแก้ไข</label>
          <textarea value={getExtra(tid, sid, 'recommendation')} onChange={e => updateExtra(tid, sid, 'recommendation', e.target.value)}
            rows={2} placeholder="คำแนะนำ..." className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-none" />
        </div>
      </div>
    )

    return null
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex gap-2 mb-6">
        {['เลือกสาขาและหัวข้อ', 'กรอกข้อมูล', 'ตรวจสอบ'].map((s, i) => (
          <div key={i} className={`flex-1 py-2 px-3 rounded-xl text-xs text-center font-medium transition-colors
            ${step === i+1 ? 'bg-blue-600 text-white' : step > i+1 ? 'bg-green-50 text-green-700' : 'bg-white text-gray-400 border border-gray-100'}`}>
            {i+1}. {s}
          </div>
        ))}
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">เลือกสาขา <span className="text-red-400">*</span></label>
                <select value={branchId} onChange={e => setBranchId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ผู้ตรวจสอบ</label>
                <input type="text" value={inspectorName} onChange={e => setInspectorName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">วันที่</label>
                <input type="date" value={inspectDate} onChange={e => setInspectDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">เวลา</label>
                <input type="time" value={inspectTime} onChange={e => setInspectTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          </div>

          {topics.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">
              ไม่มีหัวข้อสำหรับสาขานี้<br /><span className="text-xs">กรุณาตั้งค่าหัวข้อในหน้า "จัดการหัวข้อ"</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 mb-4">
              {topics.map(t => {
                const config = getBranchConfig(t)
                return (
                  <div key={t.id} onClick={() => toggleTopic(t.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all
                      ${selected.has(t.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center flex-shrink-0
                        ${selected.has(t.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                        {selected.has(t.id) && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{t.title}</div>
                        {config && (
                          <div className="flex gap-3 mt-1">
                            {config.equipment_no && <span className="text-xs text-gray-500">🔧 {config.equipment_no}</span>}
                            {config.building && <span className="text-xs text-gray-500">🏢 {config.building}</span>}
                            {config.location && <span className="text-xs text-gray-500">📍 {config.location}</span>}
                          </div>
                        )}
                        {t.sub_items && t.sub_items.length > 0 && (
                          <span className="text-xs text-gray-400 mt-0.5 block">{t.sub_items.length} หัวข้อย่อย</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={() => { if (selected.size === 0) { toast.error('กรุณาเลือกหัวข้ออย่างน้อย 1 หัวข้อ'); return } setStep(2) }}
            disabled={topics.length === 0}
            className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40">
            ถัดไป ({selected.size} หัวข้อ) →
          </button>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div>
          <div className="space-y-4 mb-4">
            {selectedTopics.map(t => {
              const config = getBranchConfig(t)
              const checkboxItems = t.sub_items?.filter(s => s.type === 'checkbox') || []
              const tripItems = t.sub_items?.filter(s => s.type === 'trip') || []
              const equipItems = t.sub_items?.filter(s => s.type === 'equipment_detail') || []
              const newTypeItems = t.sub_items?.filter(s =>
                !['checkbox', 'trip', 'equipment_detail'].includes(s.type)
              ) || []

              return (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="text-sm font-medium text-gray-900 mb-1">{t.title}</div>
                  {config && (
                    <div className="flex gap-3 mb-3 text-xs text-gray-400">
                      {config.equipment_no && <span>🔧 {config.equipment_no}</span>}
                      {config.location && <span>📍 {config.location}</span>}
                    </div>
                  )}

                  {/* ── Equipment Detail ── */}
                  {equipItems.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-600 mb-2">🔩 รายละเอียด (อุปกรณ์)</div>
                      <div className="border border-gray-100 rounded-xl p-3 space-y-2">
                        {[
                          { field: 'main_circuit' as const, label: 'Main Circuit' },
                          { field: 'cable_type' as const, label: 'ชนิดสายไฟ' },
                          { field: 'phase_size' as const, label: 'ขนาดสายเฟส (Sq.mm.)' },
                          { field: 'neutral_size' as const, label: 'ขนาดสายนิวทรัล (Sq.mm.)' },
                        ].map(({ field, label }) => (
                          <div key={field} className="flex items-center gap-3">
                            <label className="text-xs text-gray-600 w-40 flex-shrink-0">{label}</label>
                            <input type="text" value={equipValues[t.id]?.[field] || ''}
                              onChange={e => updateEquipValue(t.id, field, e.target.value)}
                              placeholder="กรอกข้อมูล"
                              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Checkbox sub-items ── */}
                  {checkboxItems.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-600 mb-2">รายการตรวจสอบ</div>
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="grid grid-cols-7 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 gap-2">
                          <div className="col-span-2">รายการ</div>
                          <div>ค่ามาตรฐาน</div>
                          <div>ค่าที่วัดได้</div>
                          <div className="text-center">ปกติ</div>
                          <div className="text-center">ไม่ปกติ</div>
                          <div>คำแนะนำ</div>
                        </div>
                        {checkboxItems.map(s => (
                          <div key={s.id} className="grid grid-cols-7 px-3 py-2.5 border-t border-gray-50 items-center gap-2">
                            <div className="col-span-2 text-xs text-gray-900">{s.label}</div>
                            <div>
                              <input type="text" value={subValues[t.id]?.[s.id]?.standard_value || ''}
                                onChange={e => updateSubValue(t.id, s.id, 'standard_value', e.target.value)}
                                placeholder="มาตรฐาน"
                                className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-blue-400" />
                            </div>
                            <div>
                              <input type="text" value={subValues[t.id]?.[s.id]?.measured_value || ''}
                                onChange={e => updateSubValue(t.id, s.id, 'measured_value', e.target.value)}
                                placeholder="ค่าที่วัดได้"
                                className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-blue-400" />
                            </div>
                            <div className="text-center">
                              <input type="radio" name={`status-${s.id}`}
                                checked={(subValues[t.id]?.[s.id]?.status ?? 'normal') === 'normal'}
                                onChange={() => updateSubValue(t.id, s.id, 'status', 'normal')}
                                className="accent-blue-600" />
                            </div>
                            <div className="text-center">
                              <input type="radio" name={`status-${s.id}`}
                                checked={subValues[t.id]?.[s.id]?.status === 'abnormal'}
                                onChange={() => updateSubValue(t.id, s.id, 'status', 'abnormal')}
                                className="accent-red-500" />
                            </div>
                            <div>
                              <input type="text" value={subValues[t.id]?.[s.id]?.recommendation || ''}
                                onChange={e => updateSubValue(t.id, s.id, 'recommendation', e.target.value)}
                                placeholder="คำแนะนำ"
                                className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-blue-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── TRIP ── */}
                  {tripItems.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-600 mb-2">⚡ รายละเอียด (แรงดันไฟฟ้า)</div>
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="grid grid-cols-2 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                          <div>รายการ</div>
                          <div>ค่าที่วัดได้</div>
                        </div>
                        {tripItems.map(s => (
                          <div key={s.id} className="grid grid-cols-2 px-3 py-2 border-t border-gray-50 items-center gap-2">
                            <div className="text-xs text-gray-900">{s.label}</div>
                            <input type="text" value={subValues[t.id]?.[s.id]?.measured_value || ''}
                              onChange={e => updateSubValue(t.id, s.id, 'measured_value', e.target.value)}
                              placeholder="กรอกค่า"
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── NEW TYPES ── */}
                  {newTypeItems.length > 0 && (
                    <div className="mb-4">
                      {newTypeItems
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(sub => renderSubItem(t, sub))}
                    </div>
                  )}

                  {/* หมายเหตุ */}
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-700 mb-2">หมายเหตุ</div>
                    <div className="space-y-2">
                      {[
                        { value: 'normal', label: 'สามารถใช้งานได้ตามปกติ', color: 'accent-blue-600' },
                        { value: 'needs_fix', label: 'ให้ทำการแก้ไขตามรายการที่ตรวจสอบ', color: 'accent-red-500' },
                      ].map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name={`remark-${t.id}`}
                            checked={(remarks[t.id] || '') === opt.value}
                            onChange={() => setRemarks(prev => ({ ...prev, [t.id]: opt.value }))}
                            className={opt.color} />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* ความคิดเห็น */}
                  <textarea value={comments[t.id] || ''}
                    onChange={e => setComments(prev => ({ ...prev, [t.id]: e.target.value }))}
                    placeholder="บันทึกความคิดเห็นเพิ่มเติม..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none mb-3" />

                  {/* แนบรูป */}
                  <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <input type="file" accept="image/*" multiple className="hidden"
                      onChange={e => handleImageChange(t.id, e.target.files)} />
                    <div className="text-lg mb-0.5">📷</div>
                    <div className="text-xs text-gray-400">แนบรูปภาพ (สูงสุด 5 รูป)</div>
                  </label>

                  {previews[t.id]?.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {previews[t.id].map((url, i) => (
                        <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => removeImage(t.id, i)}
                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">← ย้อนกลับ</button>
            <button onClick={() => saveDraft(true)} disabled={isSaving}
              className={`flex-1 border rounded-xl py-2.5 text-sm font-medium transition-all
                ${saveStatus === 'saving' ? 'border-blue-400 bg-blue-50 text-blue-600' :
                  saveStatus === 'saved' ? 'border-green-400 bg-green-50 text-green-600' :
                  'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {saveStatus === 'saving' ? '💾 กำลังบันทึก...' : saveStatus === 'saved' ? '✓ บันทึกแล้ว' : '💾 บันทึก Draft'}
            </button>
            <button onClick={() => setStep(3)} className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium">ถัดไป →</button>
          </div>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">สรุปแบบประเมิน</h2>
            <div className="text-xs text-gray-500 space-y-1.5 mb-3 pb-3 border-b border-gray-100">
              <div>สาขา: <span className="text-gray-900 font-medium">{selectedBranch?.name}</span></div>
              <div>ผู้ตรวจสอบ: <span className="text-gray-900 font-medium">{inspectorName}</span></div>
              <div>วันที่: <span className="text-gray-900 font-medium">
                {new Date(inspectDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span></div>
              <div>เวลา: <span className="text-gray-900 font-medium">{inspectTime} น.</span></div>
              <div>หัวข้อที่เลือก: <span className="text-gray-900 font-medium">{selected.size} หัวข้อ</span></div>
            </div>
            <div className="space-y-2">
              {selectedTopics.map(t => (
                <div key={t.id} className="p-2 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-900">{t.title}</div>
                  {remarks[t.id] && (
                    <div className={`text-xs mt-0.5 ${remarks[t.id] === 'normal' ? 'text-blue-600' : 'text-red-500'}`}>
                      {remarks[t.id] === 'normal' ? '✓ สามารถใช้งานได้ตามปกติ' : '✗ ให้ทำการแก้ไขตามรายการที่ตรวจสอบ'}
                    </div>
                  )}
                  {comments[t.id] && <div className="text-xs text-gray-500 mt-0.5">{comments[t.id]}</div>}
                  {previews[t.id]?.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {previews[t.id].map((url, i) => (
                        <img key={i} src={url} alt="" className="w-8 h-8 rounded object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">← ย้อนกลับ</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? 'กำลังส่ง...' : 'ส่งแบบประเมิน ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}