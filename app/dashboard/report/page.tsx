'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ============================================================
// TYPES
// ============================================================
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

  sub_item?: {
    label: string
    type: 'checkbox' | 'trip' | 'equipment_detail'
    standard_value: string | null
  }
}

interface AssessmentResult {
  id: string
  topic_id: string
  remark: string | null
  comment: string | null
  topic?: {
    title: string
    configs?: { branch_id: string; equipment_no: string | null; location: string | null }[]
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
  } catch {
    return ''
  }
}

const statusLabel = (status: string | null) =>
  status === 'abnormal' ? '✗ ไม่ปกติ' : '✓ ปกติ'

const statusColor = (status: string | null) =>
  status === 'abnormal' ? 'color:#dc2626' : 'color:#16a34a'

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

  // ── Edit modal state ──
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Assessment | null>(null)
  const [editForm, setEditForm] = useState({
    branch_name: '',
    inspector_name: '',
    inspect_date: '',
  })

  // ── Save state ──
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [editingResults, setEditingResults] = useState<Record<string, Partial<AssessmentResult>>>({})
  const [editingSubResults, setEditingSubResults] = useState<Record<string, Partial<SubItemResult>>>({})

  const supabase = createClient()

  // ============================================================
  // FETCH ASSESSMENTS LIST
  // ============================================================
  const fetchAssessments = async () => {
    const { data } = await supabase
      .from('assessments')
      .select('*, user:users(name)')
      .order('created_at', { ascending: false })
    setAssessments(data || [])
  }

  useEffect(() => { fetchAssessments() }, [])

  // ============================================================
  // SELECT ASSESSMENT
  // ============================================================
  const selectAssessment = async (a: Assessment) => {
    setSelected(a)
    const { data, error } = await supabase
      .from('assessment_results')
      .select(`
        *,
        topic:assessment_topics(
          title,
          category:assessment_categories(name),
          configs:topic_branch_config(branch_id, equipment_no, location)
        ),
        images:assessment_images(*),
        sub_results:result_sub_items(
          *,
          sub_item:topic_sub_items(label, type, standard_value)
        )
      `)
      .eq('assessment_id', a.id)
    if (error) { toast.error('โหลดข้อมูลไม่สำเร็จ'); return }
    setResults(data || [])
  }

  // ============================================================
  // GET BRANCH CONFIG FOR RESULT
  // ============================================================
  const getBranchMeta = (r: AssessmentResult) => {
    if (!selected?.branch_id || !r.topic?.configs) return null
    return r.topic.configs.find(c => c.branch_id === selected.branch_id) || null
  }

  // ============================================================
  // SAVE RESULTS
  // ============================================================
  const saveResultsToDb = async () => {
    if (!selected) return
    setSaveStatus('saving')
    setIsSaving(true)
    try {
      // อัปเดต assessment_results (remarks & comments)
      for (const resultId in editingResults) {
        const edited = editingResults[resultId]
        const result = results.find(r => r.id === resultId)
        if (!result) continue

        const { error } = await supabase
          .from('assessment_results')
          .update({
            remark: edited.remark !== undefined ? edited.remark : result.remark,
            comment: edited.comment !== undefined ? edited.comment : result.comment,
          })
          .eq('id', resultId)
        if (error) throw error
      }

      // อัปเดต result_sub_items (values)
      for (const subResultId in editingSubResults) {
        const edited = editingSubResults[subResultId]
        const { error } = await supabase
          .from('result_sub_items')
          .update({
            status: edited.status !== undefined ? edited.status : null,
            measured_value: edited.measured_value !== undefined ? edited.measured_value : null,
            note: edited.note !== undefined ? edited.note : null,
            standard_value: edited.standard_value !== undefined ? edited.standard_value : null,
            main_circuit: edited.main_circuit !== undefined ? edited.main_circuit : null,
            cable_type: edited.cable_type !== undefined ? edited.cable_type : null,
            phase_size: edited.phase_size !== undefined ? edited.phase_size : null,
            neutral_size: edited.neutral_size !== undefined ? edited.neutral_size : null,
          })
          .eq('id', subResultId)
        if (error) throw error
      }

      // รีเฟรชข้อมูลจากฐานข้อมูล
      if (selected) {
        await selectAssessment(selected)
      }

      setEditingResults({})
      setEditingSubResults({})
      setSaveStatus('saved')
      toast.success('บันทึกสำเร็จ ✓')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err: any) {
      setSaveStatus('idle')
      toast.error('บันทึกไม่สำเร็จ: ' + (err.message || 'เกิดข้อผิดพลาด'))
    } finally {
      setIsSaving(false)
    }
  }

  // ============================================================
  // AUTO-SAVE EFFECT
  // ============================================================
  useEffect(() => {
    if (!selected || (Object.keys(editingResults).length === 0 && Object.keys(editingSubResults).length === 0)) return

    const interval = setInterval(() => {
      saveResultsToDb()
    }, 30000) // auto-save ทุก 30 วินาที

    return () => clearInterval(interval)
  }, [selected, editingResults, editingSubResults])

  // ============================================================
  // EDIT ASSESSMENT METADATA
  // ============================================================
  const updateResultValue = (resultId: string, field: keyof AssessmentResult, value: any) => {
    setEditingResults(prev => ({
      ...prev,
      [resultId]: { ...prev[resultId], [field]: value }
    }))
  }

  const updateSubResultValue = (subResultId: string, field: keyof SubItemResult, value: any) => {
    setEditingSubResults(prev => ({
      ...prev,
      [subResultId]: { ...prev[subResultId], [field]: value }
    }))
  }

  const openEdit = (a: Assessment, e: React.MouseEvent) => {
    e.stopPropagation() // ป้องกัน trigger selectAssessment
    setEditTarget(a)
    setEditForm({
      branch_name: a.branch_name,
      inspector_name: a.user?.name || '',
      inspect_date: new Date(a.created_at).toISOString().split('T')[0],
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    if (!editForm.branch_name.trim()) { toast.error('กรุณาระบุชื่อสาขา'); return }

    const { error } = await supabase
      .from('assessments')
      .update({
        branch_name: editForm.branch_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editTarget.id)

    if (error) { toast.error('แก้ไขไม่สำเร็จ: ' + error.message); return }

    toast.success('แก้ไขสำเร็จ')
    setShowEditModal(false)

    // อัปเดต selected ถ้าแก้ไข assessment ที่กำลัง preview อยู่
    if (selected?.id === editTarget.id) {
      setSelected(prev => prev ? { ...prev, branch_name: editForm.branch_name } : null)
    }

    fetchAssessments()
  }

  // ============================================================
  // DELETE ASSESSMENT (cascade)
  // ============================================================
  const handleDelete = async (a: Assessment, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`ยืนยันการลบ "${a.branch_name}" ?\nข้อมูลทั้งหมดรวมถึงรูปภาพจะถูกลบถาวร`)) return

    const loadingToast = toast.loading('กำลังลบข้อมูล...')
    try {
      // 1. ดึง results ทั้งหมดของ assessment นี้
      const { data: resultList } = await supabase
        .from('assessment_results')
        .select('id')
        .eq('assessment_id', a.id)

      if (resultList && resultList.length > 0) {
        const resultIds = resultList.map(r => r.id)

        // 2. ดึง images เพื่อลบจาก Storage
        const { data: imageList } = await supabase
          .from('assessment_images')
          .select('image_url')
          .in('result_id', resultIds)

        if (imageList && imageList.length > 0) {
          // แปลง public URL → storage path
          const paths = imageList
            .map(img => {
              try {
                const url = new URL(img.image_url)
                // path format: /storage/v1/object/public/assessment-images/USER_ID/...
                const parts = url.pathname.split('/assessment-images/')
                return parts[1] || null
              } catch {
                return null
              }
            })
            .filter(Boolean) as string[]

          if (paths.length > 0) {
            await supabase.storage.from('assessment-images').remove(paths)
          }
        }

        // 3. ลบ result_sub_items
        await supabase
          .from('result_sub_items')
          .delete()
          .in('result_id', resultIds)

        // 4. ลบ assessment_images (records)
        await supabase
          .from('assessment_images')
          .delete()
          .in('result_id', resultIds)

        // 5. ลบ assessment_results
        await supabase
          .from('assessment_results')
          .delete()
          .eq('assessment_id', a.id)
      }

      // 6. ลบ assessment
      const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('id', a.id)

      if (error) throw error

      toast.dismiss(loadingToast)
      toast.success('ลบสำเร็จ')

      // ถ้า delete assessment ที่ selected อยู่ ให้ reset
      if (selected?.id === a.id) {
        setSelected(null)
        setResults([])
      }

      fetchAssessments()
    } catch (err: any) {
      toast.dismiss(loadingToast)
      toast.error('ลบไม่สำเร็จ: ' + err.message)
    }
  }

  // ============================================================
  // PRINT HTML
  // ============================================================
  const handlePrint = async () => {
    if (!selected) { toast.error('กรุณาเลือกแบบประเมินก่อน'); return }
    toast.loading('กำลังเตรียมรายงาน...')

    const dateStr = new Date(selected.created_at).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const pages = await Promise.all(results.map(async (r, idx) => {
      const meta = getBranchMeta(r)
      const checkboxItems = r.sub_results?.filter(s => s.sub_item?.type === 'checkbox') || []
      const tripItems = r.sub_results?.filter(s => s.sub_item?.type === 'trip') || []
      const equipItems = r.sub_results?.filter(s => s.sub_item?.type === 'equipment_detail') || []

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
              ${equipItems.map((s, idx) => {
                if (idx === 0) {
                  return `
                <tr>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;width:25%;background:#f9fafb;font-weight:bold;color:#374151;font-size:8.5pt;text-align:center">Main Circuit</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;width:25%;background:#f9fafb;font-weight:bold;color:#374151;font-size:8.5pt;text-align:center">ชนิดสายไฟ</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;width:25%;background:#f9fafb;font-weight:bold;color:#374151;font-size:8.5pt;text-align:center">เฟส</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;width:25%;background:#f9fafb;font-weight:bold;color:#374151;font-size:8.5pt;text-align:center">นิวทรัล</td>
                </tr>
                <tr>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;text-align:center">${s.main_circuit || '-'}</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;text-align:center">${s.cable_type || '-'}</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;text-align:center">${s.phase_size || '-'}</td>
                  <td style="border:1px solid #e5e7eb;padding:1.5mm 2mm;text-align:center">${s.neutral_size || '-'}</td>
                </tr>`;
                }
                return '';
              }).join('')}
            </tbody>
          </table>
        </div>` : ''

      let imgHtml = ''
      if (showImages && r.images?.length) {
        const imgTags = await Promise.all(r.images.map(async img => {
          const b64 = await toBase64(img.image_url)
          return b64
            ? `<img src="${b64}" style="width:55mm;height:45mm;object-fit:contain;border-radius:4px;border:1px solid #e5e7eb;margin:2mm;background:#f9fafb" />`
            : ''
        }))
        imgHtml = `
          <div style="margin-bottom:5mm">
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
            <div style="font-size:14pt;font-weight:bold;color:#1e3a8a;margin-bottom:2mm">
              หัวข้อที่ ${idx + 1}: ${r.topic?.title}
            </div>
            ${meta ? `
              <div style="display:flex;gap:6mm;margin-top:2mm">
                ${meta.equipment_no ? `<div style="font-size:10pt;color:#374151">🔧 หมายเลขอุปกรณ์: <strong>${meta.equipment_no}</strong></div>` : ''}
                ${meta.location ? `<div style="font-size:10pt;color:#374151">📍 สถานที่: <strong>${meta.location}</strong></div>` : ''}
              </div>` : ''}
          </div>
          ${equipTable}
          ${tripTable}
          ${checkboxTable}
          ${r.remark ? `
            <div style="margin-bottom:5mm">
              <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:2mm">หมายเหตุ</div>
              <div style="background:${r.remark === 'normal' ? '#dbeafe' : '#fee2e2'};border:1px solid ${r.remark === 'normal' ? '#93c5fd' : '#fecaca'};border-radius:6px;padding:4mm;font-size:11pt;color:#${r.remark === 'normal' ? '1e40af' : 'dc2626'}">
                ${r.remark === 'normal' ? 'สามารถใช้งานได้ตามปกติ' : 'ให้ทำการแก้ไขตามรายการที่ตรวจสอบ'}
              </div>
            </div>` : ''}
          ${showComments && r.comment ? `
            <div style="margin-bottom:5mm">
              <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:2mm">ความคิดเห็น</div>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:4mm;font-size:11pt;line-height:1.7;color:#374151">
                ${r.comment}
              </div>
            </div>` : ''}
          ${imgHtml}
          <div style="border-top:1px solid #e5e7eb;padding-top:3mm;font-size:9pt;color:#9ca3af;display:flex;justify-content:space-between;margin-top:10mm">
            <span>${reportName} — ${selected.branch_name}</span>
            <span>หน้า ${idx + 1} / ${results.length}</span>
          </div>
        </div>`
    }))

    toast.dismiss()

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Sarabun, sans-serif; }
    @media print { @page { size: A4; margin: 0; } }
  </style>
</head>
<body>${pages.join('')}</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) { toast.error('กรุณาอนุญาต popup ในเบราว์เซอร์'); return }
    win.document.write(html)
    win.document.close()
    win.onload = () => setTimeout(() => win.print(), 2000)
    toast.success('เปิดหน้าต่างพิมพ์แล้ว!')
  }

  // ============================================================
  // RENDER
  // ============================================================
  const dateStr = selected
    ? new Date(selected.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const toggleItems = [
    { label: 'แสดงหัวข้อย่อย', val: showSubItems, set: setShowSubItems },
    { label: 'แสดงความคิดเห็น', val: showComments, set: setShowComments },
    { label: 'แสดงรูปภาพ', val: showImages, set: setShowImages },
  ]

  return (
    <>
      <div className="grid grid-cols-3 gap-4" style={{ height: 'calc(100vh - 120px)' }}>

        {/* ── Col 1: รายการประเมิน ── */}
        <div className="col-span-1 bg-white rounded-2xl border border-gray-100 p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-900 mb-3">เลือกแบบประเมิน</h2>
          {assessments.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">ยังไม่มีรายการประเมิน</div>
          ) : (
            <div className="space-y-2">
              {assessments.map(a => (
                <div
                  key={a.id}
                  onClick={() => selectAssessment(a)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all
                    ${selected?.id === a.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{a.branch_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{a.user?.name}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(a.created_at).toLocaleDateString('th-TH')}
                      </div>
                    </div>
                    {/* ── Action buttons ── */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={e => openEdit(a, e)}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
                        title="แก้ไข"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={e => handleDelete(a, e)}
                        className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-300 hover:text-red-500 transition-colors"
                        title="ลบ"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Col 2: ตั้งค่ารายงาน ── */}
        <div className="col-span-1 bg-white rounded-2xl border border-gray-100 p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-900 mb-3">ตั้งค่ารายงาน</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่อรายงาน</label>
              <input
                type="text"
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
              />
            </div>
            {toggleItems.map(item => (
              <div key={item.label} className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-xs text-gray-600">{item.label}</span>
                <button
                  onClick={() => item.set(!item.val)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${item.val ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${item.val ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <button
                onClick={handlePrint}
                disabled={!selected}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-xs font-medium disabled:opacity-40"
              >
                🖨️ พิมพ์ / Export PDF
              </button>
              <button
                onClick={() => saveResultsToDb()}
                disabled={!selected || isSaving || (Object.keys(editingResults).length === 0 && Object.keys(editingSubResults).length === 0)}
                className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-all
                  ${saveStatus === 'saving' ? 'bg-blue-500 text-white' : 
                    saveStatus === 'saved' ? 'bg-green-500 text-white' : 
                    'border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40'}`}
              >
                {saveStatus === 'saving' ? '💾 กำลัง...' : 
                 saveStatus === 'saved' ? '✓ บันทึก' : 
                 '💾 บันทึก'}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">กด "Save as PDF" ในหน้าต่างพิมพ์</p>
          </div>
        </div>

        {/* ── Col 3: Preview ── */}
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
                  return (
                    <div key={r.id} className="p-2 bg-gray-50 rounded-lg space-y-1">
                      <div className="font-medium text-gray-900">{r.topic?.title}</div>
                      {meta && (
                        <div className="flex gap-2 text-gray-400">
                          {meta.equipment_no && <span>🔧 {meta.equipment_no}</span>}
                          {meta.location && <span>📍 {meta.location}</span>}
                        </div>
                      )}
                      {showSubItems && equipItems.length > 0 && (
                        <div className="mt-1 border border-gray-200 rounded overflow-hidden">
                          <div className="bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">🔩 รายละเอียด (อุปกรณ์)</div>
                          {equipItems.map(s => (
                            <div key={s.id} className="space-y-0">
                              <div className="grid grid-cols-4 px-2 py-0.5 border-t border-gray-100 text-xs gap-1 bg-gray-50">
                                <input
  type="text"
  value={
    editingSubResults[s.id]?.main_circuit !== undefined
      ? (editingSubResults[s.id].main_circuit ?? '')
      : (s.main_circuit ?? '')
  }
  onChange={e => updateSubResultValue(s.id, 'main_circuit', e.target.value || null)}
  placeholder="Main Circuit"
  className="text-center px-1 py-0.5 border border-gray-200 rounded text-xs"
/>

<input
  type="text"
  value={
    editingSubResults[s.id]?.cable_type !== undefined
      ? (editingSubResults[s.id].cable_type ?? '')
      : (s.cable_type ?? '')
  }
  onChange={e => updateSubResultValue(s.id, 'cable_type', e.target.value || null)}
  placeholder="สายไฟ"
  className="text-center px-1 py-0.5 border border-gray-200 rounded text-xs"
/>

<input
  type="text"
  value={
    editingSubResults[s.id]?.phase_size !== undefined
      ? (editingSubResults[s.id].phase_size ?? '')
      : (s.phase_size ?? '')
  }
  onChange={e => updateSubResultValue(s.id, 'phase_size', e.target.value || null)}
  placeholder="เฟส"
  className="text-center px-1 py-0.5 border border-gray-200 rounded text-xs"
/>

<input
  type="text"
  value={
    editingSubResults[s.id]?.neutral_size !== undefined
      ? (editingSubResults[s.id].neutral_size ?? '')
      : (s.neutral_size ?? '')
  }
  onChange={e => updateSubResultValue(s.id, 'neutral_size', e.target.value || null)}
  placeholder="นิวทรัล"
  className="text-center px-1 py-0.5 border border-gray-200 rounded text-xs"
/>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {showSubItems && tripItems.length > 0 && (
                        <div className="mt-1 border border-gray-200 rounded overflow-hidden">
                          <div className="grid grid-cols-2 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                            <div>⚡ รายละเอียด (แรงดันไฟฟ้า)</div>
                            <div>ค่าที่วัดได้</div>
                          </div>
                          {tripItems.map(s => (
                            <div key={s.id} className="grid grid-cols-2 px-2 py-1 border-t border-gray-100 text-xs gap-1">
                              <div className="text-gray-700">{s.sub_item?.label}</div>
                              <input
  type="text"
  value={
    editingSubResults[s.id]?.measured_value !== undefined
      ? (editingSubResults[s.id].measured_value ?? '')
      : (s.measured_value ?? '')
  }
  onChange={e => updateSubResultValue(s.id, 'measured_value', e.target.value || null)}
  placeholder="กรอกค่า"
  className="border border-gray-200 rounded px-1 py-0.5 text-xs"
/>
                            </div>
                          ))}
                        </div>
                      )}
                      {showSubItems && checkboxItems.length > 0 && (
                        <div className="mt-1 border border-gray-200 rounded overflow-hidden">
                          <div className="grid grid-cols-5 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 gap-1">
                            <div className="col-span-2">รายการ</div>
                            <div>สถานะ</div>
                            <div>ค่าที่วัดได้</div>
                            <div>คำแนะนำ</div>
                          </div>
                          {checkboxItems.map(s => (
                            <div key={s.id} className="grid grid-cols-5 px-2 py-1 border-t border-gray-100 text-xs gap-1">
                              <div className="col-span-2 text-gray-700">{s.sub_item?.label}</div>
                              <select
  value={
    editingSubResults[s.id]?.status !== undefined
      ? (editingSubResults[s.id].status ?? 'normal')
      : (s.status ?? 'normal')
  }
  onChange={e =>
    updateSubResultValue(
      s.id,
      'status',
      e.target.value === 'normal' ? 'normal' : 'abnormal'
    )
  }
  className="border border-gray-200 rounded px-1 py-0.5 text-xs"
>
  <option value="normal">ปกติ</option>
  <option value="abnormal">ไม่ปกติ</option>
</select>

<input
  type="text"
  value={
    editingSubResults[s.id]?.measured_value !== undefined
      ? (editingSubResults[s.id].measured_value ?? '')
      : (s.measured_value ?? '')
  }
  onChange={e => updateSubResultValue(s.id, 'measured_value', e.target.value || null)}
  placeholder="-"
  className="border border-gray-200 rounded px-1 py-0.5 text-xs"
/>

<input
  type="text"
  value={
    editingSubResults[s.id]?.note !== undefined
      ? (editingSubResults[s.id].note ?? '')
      : (s.note ?? '')
  }
  onChange={e => updateSubResultValue(s.id, 'note', e.target.value || null)}
  placeholder="แนะนำ"
  className="border border-gray-200 rounded px-1 py-0.5 text-xs"
/>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1 mt-2">
                        {/* Remark select */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600 min-w-fit">หมายเหตุ:</label>
                          <select
  value={
    editingResults[r.id]?.remark !== undefined
      ? (editingResults[r.id].remark ?? '')
      : (r.remark ?? '')
  }
  onChange={e => updateResultValue(r.id, 'remark', e.target.value || null)}
  className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
>
  <option value="">- ไม่ระบุ -</option>
  <option value="normal">✓ สามารถใช้งานได้ตามปกติ</option>
  <option value="needs_fix">✗ ให้ทำการแก้ไขตามรายการที่ตรวจสอบ</option>
</select>
                        </div>
                        {/* Comment textarea */}
                        <textarea
  value={
    editingResults[r.id]?.comment !== undefined
      ? (editingResults[r.id].comment ?? '')
      : (r.comment ?? '')
  }
  onChange={e => updateResultValue(r.id, 'comment', e.target.value || null)}
  placeholder="บันทึกความเห็น..."
  className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400 resize-none"
  rows={2}
/>
                      </div>
                      {showImages && r.images && r.images.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {r.images.map(img => (
                            <img key={img.id} src={img.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                          ))}
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

      {/* ══════════════════════════════════════════
          MODAL: แก้ไขแบบประเมิน
      ══════════════════════════════════════════ */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-sm font-medium text-gray-900 mb-4">แก้ไขแบบประเมิน</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ชื่อสาขา</label>
                <input
                  type="text"
                  value={editForm.branch_name}
                  onChange={e => setEditForm(p => ({ ...p, branch_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">วันที่ประเมิน</label>
                <input
                  type="date"
                  value={editForm.inspect_date}
                  onChange={e => setEditForm(p => ({ ...p, inspect_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
