'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ============================================================
// TYPES
// ============================================================
interface Branch {
  id: string
  name: string
  active: boolean
  created_at: string
}

interface FormData {
  name: string
}

// ============================================================
// COMPONENT
// ============================================================
export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft')

  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null)
  const [formData, setFormData] = useState<FormData>({ name: '' })

  const supabase = createClient()

  // ============================================================
  // FETCH BRANCHES
  // ============================================================
  const fetchBranches = async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      toast.error('ไม่สามารถโหลดข้อมูลสาขา: ' + error.message)
      return
    }

    setBranches(data || [])
  }

  useEffect(() => {
    fetchBranches()
  }, [])

  // ============================================================
  // ADD BRANCH
  // ============================================================
  const handleOpenAdd = () => {
    setEditingBranch(null)
    setFormData({ name: '' })
    setShowAddModal(true)
  }

  const handleSaveAdd = async () => {
    if (!formData.name.trim()) {
      toast.error('กรุณาระบุชื่อสาขา')
      return
    }

    const { error } = await supabase.from('branches').insert({
      name: formData.name.trim(),
      active: true,
    })

    if (error) {
      toast.error('เพิ่มสาขาไม่สำเร็จ: ' + error.message)
      return
    }

    toast.success('เพิ่มสาขาสำเร็จ')
    setShowAddModal(false)
    setFormData({ name: '' })
    fetchBranches()
  }

  // ============================================================
  // EDIT BRANCH
  // ============================================================
  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch)
    setFormData({ name: branch.name })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!formData.name.trim()) {
      toast.error('กรุณาระบุชื่อสาขา')
      return
    }

    if (!editingBranch) return

    const { error } = await supabase
      .from('branches')
      .update({
        name: formData.name.trim(),
      })
      .eq('id', editingBranch.id)

    if (error) {
      toast.error('แก้ไขสาขาไม่สำเร็จ: ' + error.message)
      return
    }

    toast.success('แก้ไขสาขาสำเร็จ')
    setShowEditModal(false)
    setEditingBranch(null)
    setFormData({ name: '' })
    fetchBranches()
  }

  // ============================================================
  // SOFT DELETE
  // ============================================================
  const handleSoftDelete = async (branch: Branch) => {
    const loadingToast = toast.loading('กำลังลบสาขา...')

    const { error } = await supabase
      .from('branches')
      .update({ active: false })
      .eq('id', branch.id)

    if (error) {
      toast.dismiss(loadingToast)
      toast.error('ลบสาขาไม่สำเร็จ: ' + error.message)
      return
    }

    toast.dismiss(loadingToast)
    toast.success('ปิดใช้งานสาขาสำเร็จ')

    setShowDeleteModal(false)
    setDeletingBranch(null)

    fetchBranches()
  }

  // ============================================================
  // HARD DELETE
  // ============================================================
  const handleHardDelete = async (branch: Branch) => {
    if (
      !confirm(
        `⚠️ คำเตือน: การลบนี้จะลบสาขา "${branch.name}" อย่างถาวร\n` +
          `ข้อมูลทั้งหมดที่เกี่ยวข้องจะถูกลบด้วย\n\n` +
          `ยืนยันการลบหรือไม่?`
      )
    ) {
      return
    }

    const loadingToast = toast.loading('กำลังลบสาขาอย่างถาวร...')

    try {
      // ลบ config
      const { error: configError } = await supabase
        .from('topic_branch_config')
        .delete()
        .eq('branch_id', branch.id)

      if (configError) throw configError

      // update assessments
      const { error: assessmentError } = await supabase
        .from('assessments')
        .update({ branch_id: null })
        .eq('branch_id', branch.id)

      if (assessmentError) throw assessmentError

      // delete branch
      const { error: deleteError } = await supabase
        .from('branches')
        .delete()
        .eq('id', branch.id)

      if (deleteError) throw deleteError

      toast.dismiss(loadingToast)
      toast.success('ลบสาขาอย่างถาวรสำเร็จ')

      setShowDeleteModal(false)
      setDeletingBranch(null)

      fetchBranches()
    } catch (error: any) {
      toast.dismiss(loadingToast)
      toast.error('ลบสาขาไม่สำเร็จ: ' + error.message)
    }
  }

  // ============================================================
  // RESTORE
  // ============================================================
  const handleRestore = async (branch: Branch) => {
    if (!confirm(`กู้คืนการใช้งานสาขา "${branch.name}" หรือไม่?`)) {
      return
    }

    const { error } = await supabase
      .from('branches')
      .update({ active: true })
      .eq('id', branch.id)

    if (error) {
      toast.error('กู้คืนไม่สำเร็จ: ' + error.message)
      return
    }

    toast.success('กู้คืนสาขาสำเร็จ')
    fetchBranches()
  }

  // ============================================================
  // FILTER
  // ============================================================
  const filtered = branches.filter(branch =>
    branch.name.toLowerCase().includes(search.toLowerCase())
  )

  const activeBranches = filtered.filter(branch => branch.active)
  const inactiveBranches = filtered.filter(branch => !branch.active)

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div>
      {/* Toolbar */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาสาขา..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + เพิ่มสาขาใหม่
        </button>
      </div>

      {/* ACTIVE */}
      {activeBranches.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-3 px-4">
            ใช้งานอยู่ ({activeBranches.length})
          </h3>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-100">
              <div className="col-span-2">ชื่อสาขา</div>
              <div>วันที่สร้าง</div>
              <div className="text-right">จัดการ</div>
            </div>

            {activeBranches.map(branch => (
              <div
                key={branch.id}
                className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-2">
                  <div className="text-sm font-medium text-gray-900">
                    {branch.name}
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  {new Date(branch.created_at).toLocaleDateString('th-TH')}
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => handleOpenEdit(branch)}
                    className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() => {
                      setDeletingBranch(branch)
                      setDeleteMode('soft')
                      setShowDeleteModal(true)
                    }}
                    className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INACTIVE */}
      {inactiveBranches.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-3 px-4">
            ปิดใช้งาน ({inactiveBranches.length})
          </h3>

          <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-gray-100 text-xs font-medium text-gray-600 border-b border-gray-200">
              <div className="col-span-2">ชื่อสาขา</div>
              <div>วันที่สร้าง</div>
              <div className="text-right">จัดการ</div>
            </div>

            {inactiveBranches.map(branch => (
              <div
                key={branch.id}
                className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-gray-200 items-center opacity-60 hover:opacity-100 transition-opacity"
              >
                <div className="col-span-2">
                  <div className="text-sm font-medium text-gray-500 line-through">
                    {branch.name}
                  </div>
                </div>

                <div className="text-xs text-gray-400">
                  {new Date(branch.created_at).toLocaleDateString('th-TH')}
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => handleRestore(branch)}
                    className="px-2.5 py-1 text-xs border border-green-200 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    ↩️
                  </button>

                  <button
                    onClick={() => {
                      setDeletingBranch(branch)
                      setDeleteMode('hard')
                      setShowDeleteModal(true)
                    }}
                    className="px-2.5 py-1 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    🔥
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMPTY */}
      {branches.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-2">🏢</div>

          <p className="text-sm font-medium text-gray-900">
            ยังไม่มีสาขา
          </p>

          <p className="text-xs text-gray-400 mt-1">
            เริ่มต้นด้วยการเพิ่มสาขาแรก
          </p>
        </div>
      )}

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-sm font-medium text-gray-900 mb-4">
              เพิ่มสาขาใหม่
            </h2>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                ชื่อสาขา *
              </label>

              <input
                type="text"
                value={formData.name}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="เช่น สาขาหลัก"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                autoFocus
              />
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                ยกเลิก
              </button>

              <button
                onClick={handleSaveAdd}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingBranch && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-sm font-medium text-gray-900 mb-4">
              แก้ไขสาขา
            </h2>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                ชื่อสาขา *
              </label>

              <input
                type="text"
                value={formData.name}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                autoFocus
              />
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                ยกเลิก
              </button>

              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && deletingBranch && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">
                {deleteMode === 'soft' ? '⚠️' : '🔥'}
              </div>

              <h2 className="text-sm font-medium text-gray-900">
                {deleteMode === 'soft'
                  ? 'ปิดใช้งานสาขา'
                  : 'ลบสาขาอย่างถาวร'}
              </h2>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-600">
                <strong>สาขา:</strong> {deletingBranch.name}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                ยกเลิก
              </button>

              {deleteMode === 'soft' ? (
                <>
                  <button
                    onClick={() => setDeleteMode('hard')}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
                  >
                    ลบถาวร
                  </button>

                  <button
                    onClick={() => handleSoftDelete(deletingBranch)}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                  >
                    ปิดใช้งาน
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleHardDelete(deletingBranch)}
                  className="flex-1 px-4 py-2 bg-red-700 text-white rounded-lg text-sm hover:bg-red-800"
                >
                  ลบอย่างถาวร
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}