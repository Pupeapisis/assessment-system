'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function AssessmentPage() {
  const [step, setStep] = useState(1)
  const [topics, setTopics] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<Record<string, string>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const [branchName, setBranchName] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetchTopics = async () => {
      const { data } = await supabase
        .from('assessment_topics')
        .select('*, category:assessment_categories(name)')
        .eq('active', true)
        .order('sort_order')
      setTopics(data || [])
    }
    fetchTopics()
  }, [])

  const toggleTopic = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!branchName.trim()) { toast.error('กรุณาระบุชื่อสาขา'); return }
    if (selected.size === 0) { toast.error('กรุณาเลือกหัวข้ออย่างน้อย 1 หัวข้อ'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้')

      const { data: assessment, error: ae } = await supabase
        .from('assessments')
        .insert({ user_id: user.id, branch_name: branchName, status: 'submitted' })
        .select().single()
      if (ae) throw ae

      for (const topicId of selected) {
        await supabase.from('assessment_results').insert({
          assessment_id: assessment.id,
          topic_id: topicId,
          comment: comments[topicId] || null,
          score: scores[topicId] || null,
        })
      }
      toast.success('ส่งแบบประเมินสำเร็จ!')
      setStep(1)
      setSelected(new Set())
      setComments({})
      setScores({})
      setBranchName('')
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const selectedTopics = topics.filter(t => selected.has(t.id))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex gap-2 mb-6">
        {['เลือกหัวข้อ','กรอกความคิดเห็น','ตรวจสอบ'].map((s, i) => (
          <div key={i} className={`flex-1 py-2 px-3 rounded-xl text-xs text-center font-medium transition-colors
            ${step === i+1 ? 'bg-blue-600 text-white' : step > i+1 ? 'bg-green-50 text-green-700' : 'bg-white text-gray-400 border border-gray-100'}`}>
            {i+1}. {s}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อสาขา</label>
            <input
              type="text"
              value={branchName}
              onChange={e => setBranchName(e.target.value)}
              placeholder="ระบุชื่อสาขาที่ประเมิน"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 mb-4">
            {topics.map(t => (
              <div
                key={t.id}
                onClick={() => toggleTopic(t.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all
                  ${selected.has(t.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center flex-shrink-0
                    ${selected.has(t.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {selected.has(t.id) && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 mb-1 inline-block">
                      {t.category?.name}
                    </span>
                    <div className="text-sm font-medium text-gray-900">{t.title}</div>
                    {t.description && <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { if (selected.size === 0) { toast.error('กรุณาเลือกหัวข้ออย่างน้อย 1 หัวข้อ'); return } setStep(2) }}
            className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium"
          >
            ถัดไป ({selected.size} หัวข้อ) →
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="space-y-4 mb-4">
            {selectedTopics.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="text-sm font-medium text-gray-900 mb-2">{t.title}</div>
                <div className="flex gap-1 mb-3">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onClick={() => setScores(prev => ({ ...prev, [t.id]: n }))}
                      className={`text-xl transition-colors ${(scores[t.id] || 0) >= n ? 'text-yellow-400' : 'text-gray-200'}`}
                    >★</button>
                  ))}
                </div>
                <textarea
                  value={comments[t.id] || ''}
                  onChange={e => setComments(prev => ({ ...prev, [t.id]: e.target.value }))}
                  placeholder="บันทึกความคิดเห็น..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">← ย้อนกลับ</button>
            <button onClick={() => setStep(3)} className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium">ถัดไป →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">สรุปแบบประเมิน</h2>
            <div className="text-xs text-gray-500 space-y-1.5">
              <div>สาขา: <span className="text-gray-900 font-medium">{branchName}</span></div>
              <div>หัวข้อที่เลือก: <span className="text-gray-900 font-medium">{selected.size} หัวข้อ</span></div>
            </div>
            <div className="mt-3 space-y-2">
              {selectedTopics.map(t => (
                <div key={t.id} className="p-2 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-900">{t.title}</div>
                  <div className="text-xs text-yellow-400">{'★'.repeat(scores[t.id] || 0)}{'☆'.repeat(5-(scores[t.id] || 0))}</div>
                  {comments[t.id] && <div className="text-xs text-gray-500 mt-0.5">{comments[t.id]}</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">← ย้อนกลับ</button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'กำลังส่ง...' : 'ส่งแบบประเมิน ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
