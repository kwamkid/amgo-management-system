'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, differenceInDays, addDays, isWeekend } from 'date-fns';
import { CalendarIcon, Upload, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LeaveType, LEAVE_TYPE_LABELS, LEAVE_RULES } from '@/types/leave';
import { useLeave } from '@/hooks/useLeave';
import { calculateLeaveDays, validateLeaveRequest } from '@/lib/services/leaveService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
      
      // Check if medical certificate warning needed (not required)
      if (watchType === 'sick' && days > LEAVE_RULES.sick.requireCertificate) {
        setRequireCertificate(true);
      } else {
        setRequireCertificate(false);
      }
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
      <Alert variant="warning">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-2">ยังไม่สามารถขอลาได้</p>
          <p>คุณยังไม่ได้รับการกำหนดโควต้าการลา กรุณาติดต่อฝ่ายบุคคล</p>
        </AlertDescription>
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {autoUrgent && watchType !== 'sick' && (
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>การลาด่วน:</strong> เนื่องจากไม่ได้แจ้งล่วงหน้าตามกำหนด ({LEAVE_RULES[watchType].advanceNotice} วัน) 
              จะถูกคิดโควต้า {LEAVE_RULES[watchType].urgentMultiplier} เท่า ({urgentCharge} วัน)
            </AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ประเภทการลา</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกประเภทการลา" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{label}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          (เหลือ {quota?.[value as LeaveType]?.remaining || 0} วัน)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>วันที่เริ่มลา</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "dd/MM/yyyy")
                        ) : (
                          <span>เลือกวันที่</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        // Disable based on leave type rules
                        if (!LEAVE_RULES[watchType].allowBackdate) {
                          return date < new Date();
                        }
                        return false;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>วันที่สิ้นสุด</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "dd/MM/yyyy")
                        ) : (
                          <span>เลือกวันที่</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        // ต้องไม่น้อยกว่าวันที่เริ่มลา
                        if (watchStartDate && date < watchStartDate) {
                          return true;
                        }
                        // ถ้าวันที่เริ่มไม่สามารถลาย้อนหลัง วันสิ้นสุดก็ต้องไม่น้อยกว่าวันนี้
                        if (!LEAVE_RULES[watchType].allowBackdate && date < new Date()) {
                          return true;
                        }
                        return false;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {totalDays > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              จำนวนวันลา: {totalDays} วัน (รวมเสาร์-อาทิตย์)
              {urgentCharge > totalDays && (
                <span className="text-orange-600 font-medium">
                  {' '}| ลาด่วนคิด {urgentCharge} วัน
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>เหตุผลการลา</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="กรุณาระบุเหตุผลการลา..."
                  className="resize-none"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {(requireCertificate || (form.watch('attachments')?.length ?? 0) > 0) && (
          <FormField
            control={form.control}
            name="attachments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  แนบเอกสาร
                  {requireCertificate && (
                    <span className="text-orange-600 ml-1">(แนะนำ)</span>
                  )}
                </FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    {requireCertificate && (
                      <Alert variant="warning">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          ลาป่วยเกิน {LEAVE_RULES.sick.requireCertificate} วัน แนะนำให้แนบใบรับรองแพทย์
                          {(form.watch('attachments')?.length ?? 0) === 0 && (
                            <span className="block mt-1 font-medium">
                              ⚠️ ยังไม่มีใบรับรองแพทย์ - สามารถส่งคำขอได้แต่อาจถูกขอเอกสารเพิ่มเติมภายหลัง
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </FormControl>
                <FormDescription>
                  รองรับไฟล์ JPG, PNG, PDF ขนาดไม่เกิน 5MB
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!canSubmit && (
          <Alert variant="error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              โควต้าไม่เพียงพอ! ต้องการ {urgentCharge} วัน แต่คงเหลือ {remainingQuota} วัน
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button 
            type="submit" 
            disabled={loading || !canSubmit}
            className="flex-1"
          >
            {loading ? 'กำลังส่งคำขอ...' : 'ส่งคำขอลา'}
          </Button>
        </div>
      </form>
      
      {/* Urgent Confirm Dialog */}
      <AlertDialog open={showUrgentConfirm} onOpenChange={setShowUrgentConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              แจ้งเตือนการลาด่วน
            </AlertDialogTitle>
            <AlertDialogDescription>
              การลา{LEAVE_TYPE_LABELS[watchType]}ควรแจ้งล่วงหน้า {LEAVE_RULES[watchType]?.advanceNotice || 0} วัน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="font-medium text-orange-900">หากดำเนินการต่อ:</p>
              <ul className="mt-2 space-y-1 text-sm text-orange-800">
                <li>• จะถูกคิดเป็นการลาด่วน</li>
                <li>• หักโควต้า {LEAVE_RULES[watchType]?.urgentMultiplier || 1} เท่า (รวม {urgentCharge} วัน)</li>
                <li>• คงเหลือ {remainingQuota - urgentCharge} วัน</li>
              </ul>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFormData(null)}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUrgentConfirm}
              className="bg-orange-600 hover:bg-orange-700"
            >
              ยืนยันลาด่วน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}