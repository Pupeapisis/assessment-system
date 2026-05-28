'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function ReportPage() {
  const [assessments, setAssessments] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [reportName, setReportName] = useState('รายงานการตรวจประเมิน')
  const [showComments, setShowComments] = useState(true)
  const [showScores, setShowScores] = useState(true)
  const [showImages, setShowImages] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('assessments')
        .select('*, user:users(name)')
        .order('created_at', { ascending: false })
      setAssessments(data || [])
    }
    fetch()
  }, [])

  const selectAssessment = async (a: any) => {
    setSelected(a)
    const { data } = await supabase
      .from('assessment_results')
      .select('*, topic:assessment_topics(title, category:assessment_categories(name)), images:assessment_images(*)')
      .eq('assessment_id', a.id)
    setResults(data || [])
  }

  const toBase64 = async (url: string): Promise<string> => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch {
      return ''
    }
  }

  const handlePrint = async () => {
    if (!selected) { toast.error('กรุณาเลือกแบบประเมินก่อน'); return }
    toast.loading('กำลังเตรียมรายงาน...')

    const dateStr = new Date(selected.created_at).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric'
    })

    const pages = await Promise.all(results.map(async (r, idx) => {
      let imgHtml = ''
      if (showImages && r.images?.length > 0) {
        const imgTags = await Promise.all(r.images.map(async (img: any) => {
          const b64 = await toBase64(img.image_url)
          return b64 ? `<img src="${b64}" style="width:55mm;height:45mm;object-fit:contain;border-radius:4px;border:1px solid #e5e7eb;margin:2mm;background:#f9fafb" />` : ''
        }))
        imgHtml = `
          <div style="margin-bottom:5mm">
            <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:3mm">รูปภาพ (${r.images.length} รูป)</div>
            <div style="display:flex;flex-wrap:wrap">${imgTags.join('')}</div>
          </div>`
      }

      return `
        <div style="padding:20mm;min-height:257mm;font-family:Sarabun,sans-serif;${idx < results.length-1 ? 'page-break-after:always' : ''}">
          <div style="text-align:center;border-bottom:2px solid #1e3a8a;padding-bottom:8mm;margin-bottom:8mm">
            <div style="font-size:20pt;font-weight:bold;color:#1e3a8a;margin-bottom:2mm">${reportName}</div>
            <div style="font-size:11pt;color:#555;margin-bottom:1mm">สาขา: ${selected.branch_name}</div>
            <div style="font-size:10pt;color:#777">ผู้ประเมิน: ${selected.user?.name} | วันที่: ${dateStr}</div>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:5mm;margin-bottom:6mm">
            <div style="font-size:14pt;font-weight:bold;color:#1e3a8a;margin-bottom:1mm">หัวข้อที่ ${idx+1}: ${r.topic?.title}</div>
            ${r.topic?.category?.name ? `<div style="font-size:10pt;color:#666">หมวดหมู่: ${r.topic.category.name}</div>` : ''}
          </div>
          ${showScores && r.score ? `
            <div style="margin-bottom:5mm">
              <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:2mm">คะแนน</div>
              <div style="font-size:18pt;color:#f59e0b">${'★'.repeat(r.score)}${'☆'.repeat(5-r.score)} <span style="font-size:11pt;color:#666">${r.score}/5</span></div>
            </div>` : ''}
          ${showComments && r.comment ? `
            <div style="margin-bottom:5mm">
              <div style="font-size:11pt;font-weight:bold;color:#374151;margin-bottom:2mm">ความคิดเห็น</div>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:4mm;font-size:11pt;line-height:1.7;color:#374151">${r.comment}</div>
            </div>` : ''}
          ${imgHtml}
          <div style="border-top:1px solid #e5e7eb;padding-top:3mm;font-size:9pt;color:#9ca3af;display:flex;justify-content:space-between;margin-top:10mm">
            <span>${reportName} — ${selected.branch_name}</span>
            <span>หน้า ${idx+1} / ${results.length}</span>
          </div>
        </div>`
    }))

    toast.dismiss()

    const html = `
      <!DOCTYPE html>
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

  const dateStr = selected ? new Date(selected.created_at).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : ''

  return (
    <div className="grid grid-cols-3 gap-4" style={{height:'calc(100vh - 120px)'}}>
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
                <div className="text-xs font-medium text-gray-900">{a.branch_name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{a.user?.name}</div>
                <div className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('th-TH')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

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
          {[
            { label: 'แสดงความคิดเห็น', val: showComments, set: setShowComments },
            { label: 'แสดงคะแนน', val: showScores, set: setShowScores },
            { label: 'แสดงรูปภาพ', val: showImages, set: setShowImages },
          ].map(item => (
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
          <button
            onClick={handlePrint}
            disabled={!selected}
            className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-xs font-medium disabled:opacity-40 mt-2"
          >
            🖨️ พิมพ์ / Export PDF
          </button>
          <p className="text-xs text-gray-400 text-center">กด "Save as PDF" ในหน้าต่างพิมพ์</p>
        </div>
      </div>

      <div className="col-span-1 bg-white rounded-2xl border border-gray-100 p-4 overflow-y-auto">
        <h2 className="text-sm font-medium text-gray-900 mb-1">Preview</h2>
        {selected ? (
          <div className="text-xs text-gray-500 space-y-1">
            <div>สาขา: <span className="font-medium text-gray-900">{selected.branch_name}</span></div>
            <div>ผู้ประเมิน: <span className="font-medium text-gray-900">{selected.user?.name}</span></div>
            <div>วันที่: <span className="font-medium text-gray-900">{dateStr}</span></div>
            <div className="space-y-1 mt-2">
              {results.map(r => (
                <div key={r.id} className="p-2 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">{r.topic?.title}</div>
                  {showScores && r.score && <div className="text-yellow-400">{'★'.repeat(r.score)}{'☆'.repeat(5-r.score)}</div>}
                  {showComments && r.comment && <div className="text-gray-400 mt-0.5">{r.comment}</div>}
                  {showImages && r.images?.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {r.images.map((img: any) => (
                        <img key={img.id} src={img.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-xs text-gray-400">เลือกแบบประเมินเพื่อดู Preview</div>
        )}
      </div>
    </div>
  )
}
