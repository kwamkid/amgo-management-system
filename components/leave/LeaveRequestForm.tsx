'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, differenceInDays, addDays, isWeekend } from 'date-fns';
import { CalendarIcon, Upload, AlertCircle, Info } from 'lucide-react';
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
import { LeaveType, LEAVE_TYPE_LABELS, LEAVE_RULES } from '@//types/leave';
import { useLeave } from '@/hooks/useLeave';
import { calculateLeaveDays } from '@/lib/services/leaveService';

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
  isUrgent: z.boolean().default(false),
  attachments: z.array(z.instanceof(File)).optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม",
  path: ["endDate"],
});

interface LeaveRequestFormProps {
  onSuccess?: () => void;
}

export default function LeaveRequestForm({ onSuccess }: LeaveRequestFormProps) {
  const { createLeaveRequest, quota, loading } = useLeave();
  const [totalDays, setTotalDays] = useState(0);
  const [urgentCharge, setUrgentCharge] = useState(0);
  const [requireCertificate, setRequireCertificate] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
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

  // Calculate total days when dates change
  useEffect(() => {
    if (watchStartDate && watchEndDate) {
      const days = calculateLeaveDays(watchStartDate, watchEndDate);
      setTotalDays(days);
      
      // Check if medical certificate required
      if (watchType === 'sick' && days > LEAVE_RULES.sick.requireCertificate) {
        setRequireCertificate(true);
      } else {
        setRequireCertificate(false);
      }
    }
  }, [watchStartDate, watchEndDate, watchType]);

  // Calculate urgent charge
  useEffect(() => {
    if (watchIsUrgent && watchType) {
      const multiplier = LEAVE_RULES[watchType].urgentMultiplier;
      setUrgentCharge(totalDays * multiplier);
    } else {
      setUrgentCharge(totalDays);
    }
  }, [watchIsUrgent, watchType, totalDays]);

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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await createLeaveRequest(
      values.type,
      values.startDate,
      values.endDate,
      values.reason,
      values.isUrgent,
      values.attachments
    );
    
    if (onSuccess) {
      onSuccess();
    }
  };

  const remainingQuota = quota?.[watchType]?.remaining || 0;
  const canSubmit = urgentCharge <= remainingQuota;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                          format(field.value, "PPP")
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
                          format(field.value, "PPP")
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
                      disabled={(date) => date < (watchStartDate || new Date())}
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
              จำนวนวันลา: {totalDays} วัน (ไม่รวมเสาร์-อาทิตย์)
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

        <FormField
          control={form.control}
          name="isUrgent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  ลาด่วน (ไม่ทันแจ้งล่วงหน้า)
                </FormLabel>
                <FormDescription>
                  {watchType === 'personal' && 'หากลาด่วนจะคิดโควต้า 2 เท่า'}
                  {watchType === 'vacation' && 'หากลาด่วนจะคิดโควต้า 3 เท่า'}
                  {watchType === 'sick' && 'ลาป่วยไม่คิดค่าปรับ'}
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {(requireCertificate || form.watch('attachments')?.length > 0) && (
          <FormField
            control={form.control}
            name="attachments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  แนบเอกสาร
                  {requireCertificate && (
                    <span className="text-red-500 ml-1">*</span>
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
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          ลาป่วยเกิน {LEAVE_RULES.sick.requireCertificate} วัน ต้องแนบใบรับรองแพทย์
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
          <Alert variant="destructive">
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
    </Form>
  );
}