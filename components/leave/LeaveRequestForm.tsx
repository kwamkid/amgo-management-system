'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { LeaveType, LEAVE_TYPE_LABELS, LEAVE_RULES } from '@/types/leave';
import { useLeave } from '@/hooks/useLeave';
import { calculateLeaveDays, validateLeaveRequest } from '@/lib/services/leaveService';
import { Alert, Button, Field, Select, DatePicker, Textarea, Input, ConfirmDialog, toIso } from '@/components/aoo'
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

const formSchema = z.object({
  type: z.enum(['sick', 'personal', 'vacation'] as const),
  startDate: z.date({
    required_error: "กรุณาเลือกวันที่เริ่มลา",
  }),
  endDate: z.date({
    required_error: "กรุณาเลือกวันที่สิ้นสุด",
  }),
  reason: z.string().min(10, {
    message: "กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร",
  }),
  isUrgent: z.boolean(),
  attachments: z.array(z.instanceof(File)).optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม",
  path: ["endDate"],
});

type FormData = z.infer<typeof formSchema>;

interface LeaveRequestFormProps {
  onSuccess?: () => void;
}

/** นับวันทำงาน จ–ศ ในช่วง — ใช้ตัดสินเกณฑ์ใบรับรองแพทย์ตาม ม.32 (ตั้งแต่ 3 วันทำงาน) */
function countWeekdays(start: Date | string, end: Date | string): number {
  const last = new Date(end);
  let n = 0;
  for (const d = new Date(start); d <= last; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
}

export default function LeaveRequestForm({ onSuccess }: LeaveRequestFormProps) {
  const { createLeaveRequest, quota, loading } = useLeave();
  const [totalDays, setTotalDays] = useState(0);
  const [urgentCharge, setUrgentCharge] = useState(0);
  const [requireCertificate, setRequireCertificate] = useState(false);
  const [showUrgentConfirm, setShowUrgentConfirm] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [autoUrgent, setAutoUrgent] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'sick',
      isUrgent: false,
      attachments: [],
    },
  });

  const watchType = form.watch('type');
  const watchStartDate = form.watch('startDate');
  const watchEndDate = form.watch('endDate');
  const watchIsUrgent = form.watch('isUrgent');

  // Helper function to check if urgent
  const checkIfUrgent = (type: LeaveType, startDate: Date): boolean => {
    const rules = LEAVE_RULES[type];
    if (rules.advanceNotice === 0) return false; // ลาป่วยไม่มีข้อกำหนด
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff < rules.advanceNotice;
  };

  // Calculate total days when dates change
  useEffect(() => {
    if (watchStartDate && watchEndDate) {
      const days = calculateLeaveDays(watchStartDate, watchEndDate);
      setTotalDays(days);

      // ใบรับรองแพทย์นับเฉพาะ "วันทำงาน" ตามกฎหมาย (ม.32: ตั้งแต่ 3 วันทำงานขึ้นไป)
      // นับ จ–ศ แบบปลอดภัย — คนกะหมุนเวียนอาจนับต่ำกว่าจริง ซึ่งผ่อนให้พนักงาน
      // ไม่มีทางบังคับเกินที่กฎหมายให้อำนาจ
      const workdays = countWeekdays(watchStartDate, watchEndDate);
      setRequireCertificate(watchType === 'sick' && workdays >= 3);
    }
  }, [watchStartDate, watchEndDate, watchType]);

  // Update auto urgent check when date or type changes
  useEffect(() => {
    if (watchType && watchStartDate) {
      const shouldBeUrgent = checkIfUrgent(watchType, watchStartDate);
      
      if (shouldBeUrgent !== autoUrgent) {
        setAutoUrgent(shouldBeUrgent);
        form.setValue('isUrgent', shouldBeUrgent);
      }
    }
  }, [watchType, watchStartDate]); // ไม่ใส่ autoUrgent เพื่อหลีกเลี่ยง infinite loop

  // Calculate urgent charge
  useEffect(() => {
    if (watchType && totalDays > 0) {
      const isUrgent = watchIsUrgent || autoUrgent;
      const multiplier = isUrgent ? LEAVE_RULES[watchType].urgentMultiplier : 1;
      setUrgentCharge(totalDays * multiplier);
    } else {
      setUrgentCharge(0);
    }
  }, [watchIsUrgent, watchType, totalDays, autoUrgent]);

  // Reset form when type changes
  useEffect(() => {
    // Reset dates when changing leave type
    form.setValue('startDate', undefined as any);
    form.setValue('endDate', undefined as any);
    form.setValue('isUrgent', false);
    setAutoUrgent(false);
    setTotalDays(0);
    setUrgentCharge(0);
  }, [watchType]);

  // Check if has quota
  const hasQuota = quota && (
    quota.sick.total > 0 || 
    quota.personal.total > 0 || 
    quota.vacation.total > 0
  );

  if (!hasQuota) {
    return (
      <Alert tone="warning">
        <div>
          <p className="font-medium mb-2">ยังไม่สามารถขอลาได้</p>
          <p>คุณยังไม่ได้รับการกำหนดโควต้าการลา กรุณาติดต่อฝ่ายบุคคล</p>
        </div>
      </Alert>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        form.setError('attachments', {
          message: `ไฟล์ ${file.name} มีขนาดใหญ่เกิน 5MB`
        });
        return false;
      }
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        form.setError('attachments', {
          message: `ไฟล์ ${file.name} ไม่ใช่รูปภาพหรือ PDF`
        });
        return false;
      }
      return true;
    });
    
    form.setValue('attachments', validFiles);
  };

  const onSubmit = async (values: FormData) => {
    // บังคับตามกฎหมาย: ลาป่วยตั้งแต่ 3 วันทำงานขึ้นไป ต้องมีใบรับรองแพทย์
    if (requireCertificate && !(values.attachments?.length)) {
      form.setError('attachments', {
        message:
          'ลาป่วยตั้งแต่ 3 วันทำงานขึ้นไป ต้องแนบใบรับรองแพทย์ (พ.ร.บ.คุ้มครองแรงงาน พ.ศ. 2541 มาตรา 32)',
      });
      return;
    }

    // Validate first
    const validation = validateLeaveRequest(values.type, values.startDate, values.isUrgent);
    
    // If there's a warning and not marked as urgent yet, show confirm dialog
    if (validation.warning && !values.isUrgent && !autoUrgent) {
      setPendingFormData(values);
      setShowUrgentConfirm(true);
      return;
    }
    
    // If validation failed completely
    if (!validation.valid && validation.message) {
      // This should show as form error
      form.setError('root', { message: validation.message });
      return;
    }
    
    // Proceed with submission
    await submitLeaveRequest(values);
  };
  
  const submitLeaveRequest = async (values: FormData) => {
    await createLeaveRequest(
      values.type,
      values.startDate,
      values.endDate,
      values.reason,
      values.isUrgent || autoUrgent,
      values.attachments
    );
    
    if (onSuccess) {
      onSuccess();
    }
  };
  
  const handleUrgentConfirm = async () => {
    if (!pendingFormData) return;
    
    // Mark as urgent and submit
    const updatedData = { ...pendingFormData, isUrgent: true };
    form.setValue('isUrgent', true);
    setShowUrgentConfirm(false);
    await submitLeaveRequest(updatedData);
  };

  const remainingQuota = quota?.[watchType]?.remaining || 0;
  const canSubmit = urgentCharge <= remainingQuota;

  const errors = form.formState.errors
  const todayIso = toIso(new Date())
  const startIso = watchStartDate ? toIso(watchStartDate) : ''
  const fromIso = (s: string) => new Date(`${s}T00:00:00`)
  const backdateOk = LEAVE_RULES[watchType].allowBackdate

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {autoUrgent && watchType !== 'sick' && (
          <Alert tone="warning" className="mb-4">
            <div>
              <strong>การลาด่วน:</strong> เนื่องจากไม่ได้แจ้งล่วงหน้าตามกำหนด ({LEAVE_RULES[watchType].advanceNotice} วัน)
              จะถูกคิดโควต้า {LEAVE_RULES[watchType].urgentMultiplier} เท่า ({urgentCharge} วัน)
            </div>
          </Alert>
        )}

        <Field label="ประเภทการลา" error={errors.type?.message} asDiv>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onChange={(e) => field.onChange(e.target.value as LeaveType)}>
                {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} (เหลือ {quota?.[value as LeaveType]?.remaining || 0} วัน)
                  </option>
                ))}
              </Select>
            )}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="วันที่เริ่มลา" error={errors.startDate?.message} asDiv>
            <Controller
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <DatePicker
                  value={field.value ? toIso(field.value) : ''}
                  onChange={(v) => field.onChange(v ? fromIso(v) : undefined)}
                  min={backdateOk ? undefined : todayIso}
                  placeholder="เลือกวันที่"
                />
              )}
            />
          </Field>
          <Field label="วันที่สิ้นสุด" error={errors.endDate?.message} asDiv>
            <Controller
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <DatePicker
                  value={field.value ? toIso(field.value) : ''}
                  onChange={(v) => field.onChange(v ? fromIso(v) : undefined)}
                  min={startIso || (backdateOk ? undefined : todayIso)}
                  placeholder="เลือกวันที่"
                />
              )}
            />
          </Field>
        </div>

        {totalDays > 0 && (
          <Alert tone="info">
            <div>
              จำนวนวันลา: {totalDays} วัน (รวมเสาร์-อาทิตย์)
              {urgentCharge > totalDays && (
                <span className="text-orange-600 font-medium"> | ลาด่วนคิด {urgentCharge} วัน</span>
              )}
            </div>
          </Alert>
        )}

        <Field label="เหตุผลการลา" error={errors.reason?.message} asDiv>
          <Textarea placeholder="กรุณาระบุเหตุผลการลา..." rows={4} {...form.register('reason')} />
        </Field>

        {(requireCertificate || (form.watch('attachments')?.length ?? 0) > 0) && (
          <Field
            label={requireCertificate ? 'แนบเอกสาร (แนะนำ)' : 'แนบเอกสาร'}
            help="รองรับไฟล์ JPG, PNG, PDF ขนาดไม่เกิน 5MB"
            error={errors.attachments?.message as string | undefined}
            asDiv
          >
            <div className="space-y-2">
              <Input type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} />
              {requireCertificate && (
                <Alert tone="warning">
                  <div>
                    ลาป่วย<b>ตั้งแต่ 3 วันทำงานขึ้นไป ต้องแนบใบรับรองแพทย์</b>{' '}
                    ตามพระราชบัญญัติคุ้มครองแรงงาน พ.ศ. 2541 มาตรา 32{' '}
                    <a
                      href="https://www.mol.go.th/forums/topic/ลาป่วยกรณีต้องใช้ใบรับรองแพทย์"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline"
                    >
                      อ่านข้อกฎหมาย (กระทรวงแรงงาน)
                    </a>
                    {(form.watch('attachments')?.length ?? 0) === 0 && (
                      <span className="block mt-1 font-medium">⚠️ ยังไม่ได้แนบใบรับรองแพทย์ — ส่งคำขอไม่ได้จนกว่าจะแนบ</span>
                    )}
                  </div>
                </Alert>
              )}
            </div>
          </Field>
        )}

        {errors.root?.message && <Alert tone="error">{errors.root.message}</Alert>}

        {!canSubmit && (
          <Alert tone="error">
            <div>โควต้าไม่เพียงพอ! ต้องการ {urgentCharge} วัน แต่คงเหลือ {remainingQuota} วัน</div>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading || !canSubmit} className="flex-1">
            {loading ? 'กำลังส่งคำขอ...' : 'ส่งคำขอลา'}
          </Button>
        </div>
      </form>

      {/* ยืนยันลาด่วน */}
      <ConfirmDialog
        open={showUrgentConfirm}
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            แจ้งเตือนการลาด่วน
          </span>
        }
        description={`การลา${LEAVE_TYPE_LABELS[watchType]}ควรแจ้งล่วงหน้า ${LEAVE_RULES[watchType]?.advanceNotice || 0} วัน`}
        confirmLabel="ยืนยันลาด่วน"
        cancelLabel="ยกเลิก"
        tone="primary"
        onConfirm={handleUrgentConfirm}
        onClose={() => { setShowUrgentConfirm(false); setPendingFormData(null) }}
      >
        <div className="bg-orange-50 p-4 rounded-lg">
          <p className="font-medium text-orange-900">หากดำเนินการต่อ:</p>
          <ul className="mt-2 space-y-1 text-sm text-orange-800">
            <li>• จะถูกคิดเป็นการลาด่วน</li>
            <li>• หักโควต้า {LEAVE_RULES[watchType]?.urgentMultiplier || 1} เท่า (รวม {urgentCharge} วัน)</li>
            <li>• คงเหลือ {remainingQuota - urgentCharge} วัน</li>
          </ul>
        </div>
      </ConfirmDialog>
    </>
  );
}
