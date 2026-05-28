'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function ReportPage() {
  const [assessments, setAssessments] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [reportName, setReportName] = useState('รายงานการตรวจประเมิน')
  const [showImages, setShowImages] = useState(true)
  const [showComments, setShowComments] = useState(true)
  const [showScores, setShowScores] = useState(true)
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
      .select('*, topic:assessment_topics(title)')
      .eq('assessment_id', a.id)
    setResults(data || [])
  }

  const handleExport = () => {
    toast.success('กำลัง Export PDF...')
  }

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
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
                <div className="text-xs text-gray-400">
                  {new Date(a.created_at).toLocaleDateString('th-TH')}
                </div>
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
          <div className="space-y-2">
            {[
              { label: 'แสดงรูปภาพ', val: showImages, set: setShowImages },
              { label: 'แสดงความคิดเห็น', val: showComments, set: setShowComments },
              { label: 'แสดงคะแนน', val: showScores, set: setShowScores },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-600">{item.label}</span>
                <button
                  onClick={() => item.set(!item.val)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${item.val ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${item.val ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleExport}
            disabled={!selected}
            className="w-full bg-blue-600 text-white rounded-xl py-2 text-xs font-medium disabled:opacity-40 mt-2"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="col-span-1 bg-white rounded-2xl border border-gray-100 p-4 overflow-y-auto">
        <h2 className="text-sm font-medium text-gray-900 mb-1">{reportName}</h2>
        {selected ? (
          <div>
            <div className="text-xs text-gray-400 mb-3">
              สาขา: {selected.branch_name} | {new Date(selected.created_at).toLocaleDateString('th-TH')}
            </div>
            {results.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">ไม่มีข้อมูล</div>
            ) : (
              <div className="space-y-2">
                {results.map(r => (
                  <div key={r.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="text-xs font-medium text-gray-900">{r.topic?.title}</div>
                    {showScores && r.score && (
                      <div className="text-xs text-yellow-400 mt-0.5">
                        {'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}
                      </div>
                    )}
                    {showComments && r.comment && (
                      <div className="text-xs text-gray-500 mt-1">{r.comment}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 text-xs text-gray-400">
            เลือกแบบประเมินเพื่อดู Preview
          </div>
        )}
      </div>
    </div>
  )
}
