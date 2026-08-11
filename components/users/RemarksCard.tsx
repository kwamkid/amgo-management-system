'use client'

// components/users/RemarksCard.tsx
//
// โน้ตต่อพนักงาน (remark) — บันทึกตามวันเวลา เห็นเฉพาะ HR/แอดมิน (RLS คุมอีกชั้น)
// เริ่มต้นมีหมายเหตุเงินเดือนที่นำเข้าจากทะเบียนพนักงานของเจ้าของ

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StickyNote, Plus, Trash2 } from 'lucide-react'

interface Remark {
  id: string
  remark: string
  remark_date: string
  created_by_name: string
}

export default function RemarksCard({ userId }: { userId: string }) {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [remarks, setRemarks] = useState<Remark[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchRemarks = async () => {
    const { data, error } = await createClient()
      .from('user_remarks')
      .select('id, remark, remark_date, created_by_name')
      .eq('user_id', userId)
      .order('remark_date', { ascending: false })

    if (error) showToast(`โหลดโน้ตไม่สำเร็จ: ${error.message}`, 'error')
    setRemarks((data as Remark[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchRemarks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const addRemark = async () => {
    const text = draft.trim()
    if (!text) return

    setSaving(true)
    const { error } = await createClient().from('user_remarks').insert({
      user_id: userId,
      remark: text,
      created_by: userData?.id ?? null,
      created_by_name: userData?.displayName || userData?.fullName || '',
    })
    setSaving(false)

    if (error) {
      showToast(`บันทึกโน้ตไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    setDraft('')
    fetchRemarks()
  }

  const removeRemark = async (id: string) => {
    if (!confirm('ลบโน้ตนี้ใช่ไหม?')) return
    const { error } = await createClient().from('user_remarks').delete().eq('id', id)
    if (error) {
      showToast(`ลบโน้ตไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    fetchRemarks()
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-amber-600" />
          โน้ต / Remark
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* เพิ่มโน้ตใหม่ */}
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="จดโน้ตเกี่ยวกับพนักงานคนนี้ เช่น เงื่อนไขเงินเดือน ค่าคอม ข้อตกลงพิเศษ..."
            rows={3}
            disabled={saving}
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={addRemark} disabled={saving || !draft.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              เพิ่มโน้ต
            </Button>
          </div>
        </div>

        {/* รายการโน้ต ใหม่ → เก่า */}
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-4">กำลังโหลด...</p>
        ) : remarks.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">ยังไม่มีโน้ต</p>
        ) : (
          <div className="space-y-3">
            {remarks.map((r) => (
              <div key={r.id} className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-gray-500">
                    {fmt(r.remark_date)}
                    {r.created_by_name && <> · {r.created_by_name}</>}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeRemark(r.id)}
                    className="p-1 rounded hover:bg-amber-100 text-gray-400 hover:text-red-600"
                    title="ลบโน้ต"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{r.remark}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
