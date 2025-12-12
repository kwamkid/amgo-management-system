'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowRight,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Heart,
  Briefcase,
  Activity,
  RefreshCw,
  History
} from 'lucide-react'
import {
  CarryOverRules,
  CarryOverSummary,
  DEFAULT_CARRY_OVER_RULES
} from '@/types/leave'
import { carryOverQuotaForAllUsers, checkCarryOverExists, checkQuotaExistsForYear } from '@/lib/services/leaveService'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface CarryOverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: Array<{ id: string; fullName: string }>
  currentYear: number
  executedBy: string
  onSuccess: () => void
}

export default function CarryOverDialog({
  open,
  onOpenChange,
  users,
  currentYear,
  executedBy,
  onSuccess
}: CarryOverDialogProps) {
  const [step, setStep] = useState<'config' | 'confirm' | 'processing' | 'result'>('config')
  const [rules, setRules] = useState<CarryOverRules>(DEFAULT_CARRY_OVER_RULES)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<CarryOverSummary | null>(null)
  const [previousCarryOver, setPreviousCarryOver] = useState<any | null>(null)
  const [checkingPrevious, setCheckingPrevious] = useState(false)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const [quotaStatus, setQuotaStatus] = useState<{
    hasQuota: boolean;
    usersWithQuota: number;
    usersWithoutQuota: string[];
  } | null>(null)

  const fromYear = currentYear - 1
  const toYear = currentYear

  // เช็คว่าเคยยกยอดไปแล้วหรือยัง และมีโควต้าปีใหม่หรือยัง เมื่อเปิด Dialog
  useEffect(() => {
    if (open && users.length > 0) {
      setCheckingPrevious(true)

      Promise.all([
        checkCarryOverExists(fromYear, toYear),
        checkQuotaExistsForYear(toYear, users.map(u => u.id))
      ])
        .then(([carryOverResult, quotaResult]) => {
          if (carryOverResult.exists) {
            setPreviousCarryOver(carryOverResult.lastCarryOver)
          } else {
            setPreviousCarryOver(null)
          }
          setQuotaStatus(quotaResult)
        })
        .catch(console.error)
        .finally(() => setCheckingPrevious(false))
    }
  }, [open, fromYear, toYear, users])

  const handleRuleChange = (
    type: 'sick' | 'personal' | 'vacation',
    field: 'enabled' | 'maxDays' | 'percentage',
    value: boolean | number | null
  ) => {
    setRules(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }))
  }

  const handleCarryOver = async () => {
    setStep('processing')
    setIsProcessing(true)

    try {
      const summary = await carryOverQuotaForAllUsers(
        users.map(u => ({ id: u.id, fullName: u.fullName })),
        fromYear,
        toYear,
        rules,
        executedBy
      )

      setResult(summary)
      setStep('result')
      onSuccess()
    } catch (error) {
      console.error('Carry over failed:', error)
      setResult({
        totalUsers: users.length,
        successCount: 0,
        failedCount: users.length,
        results: [],
        executedBy,
        executedAt: new Date()
      })
      setStep('result')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    setStep('config')
    setRules(DEFAULT_CARRY_OVER_RULES)
    setResult(null)
    setPreviousCarryOver(null)
    setConfirmDuplicate(false)
    setQuotaStatus(null)
    onOpenChange(false)
  }

  const leaveTypes = [
    {
      type: 'sick' as const,
      label: 'ลาป่วย',
      icon: <Heart className="w-4 h-4" />,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50'
    },
    {
      type: 'personal' as const,
      label: 'ลากิจ',
      icon: <Briefcase className="w-4 h-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      type: 'vacation' as const,
      label: 'ลาพักร้อน',
      icon: <Activity className="w-4 h-4" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    }
  ]

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-red-600" />
            ยกยอดโควต้าวันลา
          </DialogTitle>
          <DialogDescription>
            ยกยอดวันลาคงเหลือจากปี {fromYear} ไปปี {toYear}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Config */}
        {step === 'config' && (
          <div className="space-y-4">
            {/* Loading state */}
            {checkingPrevious ? (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  กำลังตรวจสอบข้อมูล...
                </AlertDescription>
              </Alert>
            ) : quotaStatus && !quotaStatus.hasQuota ? (
              /* Error: ยังไม่มีโควต้าปีใหม่ */
              <Alert variant="error" className="border-red-300 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong className="block mb-1">❌ ยังไม่มีโควต้าปี {toYear}</strong>
                  <span className="text-sm">
                    กรุณาตั้งโควต้าปี {toYear} ให้กับพนักงานก่อน จึงจะสามารถยกยอดได้
                  </span>
                  <p className="text-sm mt-2">
                    ไปที่ <strong>การลา → จัดการโควต้า</strong> เพื่อตั้งค่าโควต้าปี {toYear}
                  </p>
                </AlertDescription>
              </Alert>
            ) : quotaStatus && quotaStatus.usersWithoutQuota.length > 0 ? (
              /* Warning: มีบางคนยังไม่มีโควต้าปีใหม่ */
              <Alert variant="warning" className="border-amber-300 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong className="block mb-1">⚠️ มีพนักงานบางคนยังไม่มีโควต้าปี {toYear}</strong>
                  <span className="text-sm">
                    มีโควต้าแล้ว: {quotaStatus.usersWithQuota} คน
                    <br />
                    ยังไม่มีโควต้า: {quotaStatus.usersWithoutQuota.length} คน
                  </span>
                  <p className="text-sm mt-2">
                    พนักงานที่ยังไม่มีโควต้าปี {toYear} จะถูกสร้างโควต้าใหม่พร้อมยอดยกมา (โควต้าพื้นฐาน = 0)
                  </p>
                </AlertDescription>
              </Alert>
            ) : previousCarryOver ? (
              /* Warning: เคยยกยอดไปแล้ว */
              <Alert variant="error" className="border-red-300 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong className="block mb-1">⚠️ เคยยกยอดจากปี {fromYear} ไปปี {toYear} แล้ว!</strong>
                  <span className="text-sm">
                    ยกยอดล่าสุดเมื่อ: {format(new Date(previousCarryOver.executedAt), 'd MMMM yyyy HH:mm น.', { locale: th })}
                    <br />
                    โดย: {previousCarryOver.executedBy}
                    <br />
                    ผลลัพธ์: สำเร็จ {previousCarryOver.successCount} คน
                  </span>
                  <p className="text-sm mt-2 font-medium text-red-700">
                    หากยกยอดอีกครั้ง โควต้าจะถูกเพิ่มซ้ำ (ไม่ใช่การแทนที่)
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              /* Normal state */
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong className="block mb-1">✓ พร้อมยกยอด</strong>
                  <span className="text-sm">
                    พนักงาน {quotaStatus?.usersWithQuota || 0} คน มีโควต้าปี {toYear} เรียบร้อย
                    <br />
                    ระบบจะเพิ่มวันลาคงเหลือจากปี {fromYear} ไปยังโควต้าปี {toYear}
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <Label className="text-base font-medium">ตั้งค่าการยกยอดแต่ละประเภท</Label>

              {leaveTypes.map(({ type, label, icon, color, bgColor }) => (
                <div
                  key={type}
                  className={`p-4 rounded-lg border ${rules[type].enabled ? bgColor : 'bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`flex items-center gap-2 ${color}`}>
                      {icon}
                      <span className="font-medium">{label}</span>
                    </div>
                    <Switch
                      checked={rules[type].enabled}
                      onCheckedChange={(checked) => handleRuleChange(type, 'enabled', checked)}
                    />
                  </div>

                  {rules[type].enabled && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <Label className="text-xs text-gray-500">จำนวนวันสูงสุด</Label>
                        <Input
                          type="number"
                          value={rules[type].maxDays ?? ''}
                          onChange={(e) => handleRuleChange(
                            type,
                            'maxDays',
                            e.target.value ? parseInt(e.target.value) : null
                          )}
                          placeholder="ไม่จำกัด"
                          className="h-8 mt-1"
                          min={0}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">เปอร์เซ็นต์ที่ยกยอด</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Input
                            type="number"
                            value={rules[type].percentage}
                            onChange={(e) => handleRuleChange(
                              type,
                              'percentage',
                              parseInt(e.target.value) || 0
                            )}
                            className="h-8"
                            min={0}
                            max={100}
                          />
                          <span className="text-gray-500">%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                ยกเลิก
              </Button>
              <Button
                onClick={() => {
                  setConfirmDuplicate(false)
                  setStep('confirm')
                }}
                className="bg-gradient-to-r from-red-500 to-rose-600"
                disabled={
                  (!rules.sick.enabled && !rules.personal.enabled && !rules.vacation.enabled) ||
                  checkingPrevious ||
                  (quotaStatus !== null && !quotaStatus.hasQuota)
                }
              >
                ถัดไป
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            {previousCarryOver ? (
              <Alert variant="error" className="border-red-300 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>⚠️ คำเตือน: กำลังยกยอดซ้ำ!</strong>
                  <br />
                  <span className="text-sm">
                    คุณเคยยกยอดจากปี {fromYear} ไปปี {toYear} แล้ว
                    การยกยอดอีกครั้งจะทำให้โควต้าถูกเพิ่มซ้ำ
                  </span>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>ยืนยันการยกยอดโควต้า</strong>
                  <br />
                  การดำเนินการนี้ไม่สามารถยกเลิกได้
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">จากปี</span>
                <Badge variant="outline">{fromYear}</Badge>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">ไปปี</span>
                <Badge variant="outline">{toYear}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t">
                <span className="text-gray-600">จำนวนพนักงาน</span>
                <Badge>{users.length} คน</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-gray-600">การยกยอดที่เลือก:</Label>
              <div className="flex flex-wrap gap-2">
                {rules.sick.enabled && (
                  <Badge variant="secondary" className="bg-pink-100 text-pink-700">
                    ลาป่วย {rules.sick.maxDays ? `(สูงสุด ${rules.sick.maxDays} วัน)` : '(ไม่จำกัด)'}
                  </Badge>
                )}
                {rules.personal.enabled && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    ลากิจ {rules.personal.maxDays ? `(สูงสุด ${rules.personal.maxDays} วัน)` : '(ไม่จำกัด)'}
                  </Badge>
                )}
                {rules.vacation.enabled && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                    ลาพักร้อน {rules.vacation.maxDays ? `(สูงสุด ${rules.vacation.maxDays} วัน)` : '(ไม่จำกัด)'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Checkbox ยืนยันเมื่อยกยอดซ้ำ */}
            {previousCarryOver && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <Checkbox
                  id="confirm-duplicate"
                  checked={confirmDuplicate}
                  onCheckedChange={(checked) => setConfirmDuplicate(checked as boolean)}
                />
                <Label
                  htmlFor="confirm-duplicate"
                  className="text-sm text-red-800 cursor-pointer leading-relaxed"
                >
                  ฉันเข้าใจว่าการยกยอดซ้ำจะทำให้โควต้าถูกเพิ่มอีกครั้ง และต้องการดำเนินการต่อ
                </Label>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('config')}>
                ย้อนกลับ
              </Button>
              <Button
                onClick={handleCarryOver}
                className="bg-gradient-to-r from-red-500 to-rose-600"
                disabled={previousCarryOver && !confirmDuplicate}
              >
                ยืนยันยกยอด
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">กำลังยกยอดโควต้า...</p>
            <p className="text-sm text-gray-500 mt-2">
              กรุณารอสักครู่ กำลังประมวลผลพนักงาน {users.length} คน
            </p>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <div className="space-y-4">
            {result.successCount === result.totalUsers ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  ยกยอดโควต้าสำเร็จทั้งหมด {result.successCount} คน
                </AlertDescription>
              </Alert>
            ) : result.failedCount === result.totalUsers ? (
              <Alert variant="error">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  ยกยอดโควต้าล้มเหลวทั้งหมด
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  ยกยอดสำเร็จ {result.successCount} คน, ล้มเหลว {result.failedCount} คน
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{result.totalUsers}</p>
                  <p className="text-xs text-gray-500">ทั้งหมด</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{result.successCount}</p>
                  <p className="text-xs text-gray-500">สำเร็จ</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{result.failedCount}</p>
                  <p className="text-xs text-gray-500">ล้มเหลว</p>
                </div>
              </div>
            </div>

            {/* Summary of carried over days */}
            {result.results.length > 0 && result.successCount > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">สรุปวันที่ยกยอด:</Label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.results
                    .filter(r => r.success && (r.sick.carriedOver > 0 || r.personal.carriedOver > 0 || r.vacation.carriedOver > 0))
                    .slice(0, 10)
                    .map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm bg-white p-2 rounded">
                        <span className="text-gray-700">{r.userName}</span>
                        <div className="flex gap-2">
                          {r.sick.carriedOver > 0 && (
                            <Badge variant="secondary" className="bg-pink-50 text-pink-600 text-xs">
                              ป่วย +{r.sick.carriedOver}
                            </Badge>
                          )}
                          {r.personal.carriedOver > 0 && (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-600 text-xs">
                              กิจ +{r.personal.carriedOver}
                            </Badge>
                          )}
                          {r.vacation.carriedOver > 0 && (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-xs">
                              พักร้อน +{r.vacation.carriedOver}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  {result.results.filter(r => r.success).length > 10 && (
                    <p className="text-xs text-gray-500 text-center">
                      และอีก {result.results.filter(r => r.success).length - 10} คน...
                    </p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                ปิด
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
