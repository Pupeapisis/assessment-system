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
  label: string
  type: SubItemType
  sort_order: number
}

interface BranchConfig {
  branch_id: string
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

interface Branch {
  id: string
  name: string
}

type SubValues = Record<string, Record<string, {
  status?: 'normal' | 'abnormal'
  standard_value?: string
  measured_value?: string
  recommendation?: string
}>>

// equipment_detail values per topic
type EquipmentValues = Record<string, {
  main_circuit?: string
  cable_type?: string
  phase_size?: string
  neutral_size?: string
}>

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

        // โหลด draft ล่าสุด (ถ้ามี)
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
            if (formData.selectedTopics) {
              setSelected(new Set(formData.selectedTopics))
            }
            toast.success('โหลด Draft ก่อนหน้าแล้ว ✓')
          } catch (e) {
            console.error('Error parsing draft:', e)
          }
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
      setSelected(new Set())
    }
    fetchTopics()
  }, [branchId])

  // ============================================================
  // HELPERS
  // ============================================================
  const getBranchConfig = (t: Topic): BranchConfig | undefined =>
    t.configs?.find(c => c.branch_id === branchId)

  const toggleTopic = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const updateSubValue = (topicId: string, subId: string, field: string, value: string) => {
    setSubValues(prev => ({
      ...prev,
      [topicId]: { ...prev[topicId], [subId]: { ...prev[topicId]?.[subId], [field]: value } },
    }))
  }

  const updateEquipValue = (topicId: string, field: keyof EquipmentValues[string], value: string) => {
    setEquipValues(prev => ({
      ...prev,
      [topicId]: { ...prev[topicId], [field]: value },
    }))
  }

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
    setStep(1)
    setSelected(new Set())
    setComments({})
    setRemarks({})
    setSubValues({})
    setEquipValues({})
    setImages({})
    setPreviews({})
  }

  // ============================================================
  // DRAFT SAVE
  // ============================================================
  const saveDraft = async (isDraft = true) => {
    if (!branchId) { toast.error('กรุณาเลือกสาขา'); return }
    if (selected.size === 0) { toast.error('กรุณาเลือกหัวข้ออย่างน้อย 1 หัวข้อ'); return }
    
    setSaveStatus('saving')
    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้')

      const branch = branches.find(b => b.id === branchId)
      
      // สร้างหรืออัปเดต draft
      if (!draftId) {
        const { data: newDraft, error: ae } = await supabase
          .from('assessments')
          .insert({
            user_id: user.id,
            branch_name: branch?.name,
            branch_id: branchId,
            status: isDraft ? 'draft' : 'submitted',
            form_data: JSON.stringify({
              inspectorName,
              inspectDate,
              inspectTime,
              selectedTopics: Array.from(selected),
              comments,
              remarks,
              subValues,
              equipValues,
            }),
          })
          .select()
          .single()
        if (ae) throw ae
        setDraftId(newDraft.id)
      } else {
        const { error: ue } = await supabase
          .from('assessments')
          .update({
            branch_name: branch?.name,
            form_data: JSON.stringify({
              inspectorName,
              inspectDate,
              inspectTime,
              selectedTopics: Array.from(selected),
              comments,
              remarks,
              subValues,
              equipValues,
            }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId)
        if (ue) throw ue
      }

      setSaveStatus('saved')
      toast.success('บันทึก Draft สำเร็จ')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err: any) {
      setSaveStatus('idle')
      toast.error('บันทึก Draft ไม่สำเร็จ: ' + (err.message || 'เกิดข้อผิดพลาด'))
    } finally {
      setIsSaving(false)
    }
  }

  // ============================================================
  // AUTO-SAVE EFFECT
  // ============================================================
  useEffect(() => {
    if (step !== 2 || !branchId || selected.size === 0) return
    
    const interval = setInterval(() => {
      saveDraft(true)
    }, 30000) // auto-save ทุก 30 วินาที

    return () => clearInterval(interval)
  }, [step, branchId, selected, inspectorName, inspectDate, inspectTime, comments, remarks, subValues, equipValues])

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
      
      // ถ้ามี draft id ให้อัปเดต status เป็น submitted แล้วใช้ ID นั้น
      let assessment_id = draftId
      if (draftId) {
        const { error: ue } = await supabase
          .from('assessments')
          .update({ status: 'submitted' })
          .eq('id', draftId)
        if (ue) throw ue
      } else {
        // สร้าง assessment ใหม่หากไม่มี draft
        const { data: assessment, error: ae } = await supabase
          .from('assessments')
          .insert({ user_id: user.id, branch_name: branch?.name, branch_id: branchId, status: 'submitted' })
          .select().single()
        if (ae) throw ae
        assessment_id = assessment.id
      }

      // บันทึก assessment_results ส่วนการประเมินรายหัวข้อ
      for (const topicId of selected) {
        const { data: result, error: re } = await supabase
          .from('assessment_results')
          .insert({
            assessment_id: assessment_id,
            topic_id: topicId,
            remark: remarks[topicId] || null,
            comment: comments[topicId] || null,
          })
          .select().single()
        if (re) throw re

        // บันทึก checkbox + trip sub_items
        const topicSubValues = subValues[topicId] || {}
        for (const [subId, vals] of Object.entries(topicSubValues)) {
          await supabase.from('result_sub_items').insert({
            result_id: result.id,
            sub_item_id: subId,
            status: vals.status || 'normal',
            standard_value: vals.standard_value || null,
            measured_value: vals.measured_value || null,
            note: vals.recommendation || null,
          })
        }

        // บันทึก equipment_detail sub_items
        const topic = topics.find(t => t.id === topicId)
        const equipSubItems = topic?.sub_items?.filter(s => s.type === 'equipment_detail') || []
        const ev = equipValues[topicId]
        if (equipSubItems.length > 0 && ev) {
          await supabase.from('result_sub_items').insert({
            result_id: result.id,
            sub_item_id: equipSubItems[0].id,
            main_circuit: ev.main_circuit || null,
            cable_type: ev.cable_type || null,
            phase_size: ev.phase_size || null,
            neutral_size: ev.neutral_size || null,
          })
        }

        // อัปโหลดรูป
        for (const file of images[topicId] || []) {
          const path = `${user.id}/${assessment_id}/${result.id}/${Date.now()}-${file.name}`
          const { error: ue } = await supabase.storage.from('assessment-images').upload(path, file)
          if (ue) continue
          const { data: { publicUrl } } = supabase.storage.from('assessment-images').getPublicUrl(path)
          await supabase.from('assessment_images').insert({ result_id: result.id, image_url: publicUrl, file_name: file.name })
        }
      }

      toast.success('ส่งแบบประเมินสำเร็จ!')
      resetForm()
      setDraftId(null)
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const selectedTopics = topics.filter(t => selected.has(t.id))
  const selectedBranch = branches.find(b => b.id === branchId)

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
                            <input
                              type="text"
                              value={equipValues[t.id]?.[field] || ''}
                              onChange={e => updateEquipValue(t.id, field, e.target.value)}
                              placeholder="กรอกข้อมูล"
                              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
                            />
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

                  {/* ── TRIP (แรงดันไฟฟ้า) sub-items ── */}
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
              {saveStatus === 'saving' ? '💾 กำลังบันทึก...' : 
               saveStatus === 'saved' ? '✓ บันทึกแล้ว' : 
               '💾 บันทึก Draft'}
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