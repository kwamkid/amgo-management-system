// ========== FILE: components/dashboard/EmployeeSection.tsx ==========
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Cake,
  Gift,
  PartyPopper,
} from 'lucide-react';
import { UserData } from '@/hooks/useAuth';
import { format, addDays, isSameDay, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, getDate, isToday } from 'date-fns';
import { th } from 'date-fns/locale';

import { Pill, Card, CardContent, CardHeader, CardTitle, Modal, EmptyState } from '@/components/aoo'
import { DateStepper, InfoPanel, ListRow, ListRows, UserAvatar } from '@/components/shared'
interface EmployeeSectionProps {
  userData: UserData;
}

interface BirthdayUser {
  id: string;
  fullName: string;
  lineDisplayName: string;
  linePictureUrl?: string;
  birthDate: Date;
  role: string;
  locationIds?: string[];
}

export default function EmployeeSection({ userData }: EmployeeSectionProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBirthdayDialog, setShowBirthdayDialog] = useState(false);
  
  // ดึงครั้งเดียวตอนเปิดหน้า แล้วเก็บไว้ทั้งปี
  // ของเดิมใส่ currentMonth ไว้ใน dependency → กดเปลี่ยนเดือนทีก็ยิง API ใหม่ทุกครั้ง
  // ทั้งที่ข้อมูลชุดเดิม (พนักงาน 56 คน) กรองในเครื่องได้เลย
  useEffect(() => {
    let cancelled = false

    const fetchBirthdays = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/users/birthdays')
        if (!res.ok) throw new Error('โหลดวันเกิดไม่สำเร็จ')

        const { birthdays: all } = await res.json()
        if (cancelled) return

        setBirthdays(
          all.map((u: { id: string; fullName: string; lineDisplayName: string; linePictureUrl?: string; birthDate: string; role: string }) => ({
            ...u,
            birthDate: new Date(u.birthDate),
          }))
        )
      } catch (error) {
        console.error('โหลดวันเกิดไม่สำเร็จ:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchBirthdays()
    return () => { cancelled = true }
  }, []);
  
  // Get upcoming birthdays (within ±5 days)
  const getUpcomingBirthdays = () => {
    const today = new Date();
    const fiveDaysAgo = addDays(today, -5);
    const fiveDaysLater = addDays(today, 5);
    
    return birthdays.filter(user => {
      // Create birthday date for this year
      const birthdayThisYear = new Date(
        today.getFullYear(),
        user.birthDate.getMonth(),
        user.birthDate.getDate()
      );
      
      return isWithinInterval(birthdayThisYear, { start: fiveDaysAgo, end: fiveDaysLater });
    });
  };
  
  const upcomingBirthdays = getUpcomingBirthdays();
  
  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // เฉพาะคนที่เกิดเดือนที่กำลังเปิดดูอยู่
  const monthBirthdays = useMemo(
    () =>
      birthdays
        .filter((u: BirthdayUser) => u.birthDate.getMonth() === currentMonth.getMonth())
        .sort((a: BirthdayUser, b: BirthdayUser) => a.birthDate.getDate() - b.birthDate.getDate()),
    [birthdays, currentMonth]
  );

  // Get birthdays for a specific day
  const getBirthdaysForDay = (day: Date) => {
    return monthBirthdays.filter(user => user.birthDate.getDate() === day.getDate());
  };

  // Handle date click
  const handleDateClick = (day: Date) => {
    const dayBirthdays = getBirthdaysForDay(day);
    if (dayBirthdays.length > 0) {
      setSelectedDate(day);
      setShowBirthdayDialog(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Calendar */}
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={Cake} tone="pink">
              ปฏิทินวันเกิดพนักงาน
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-center mb-6">
              <DateStepper
                label={format(currentMonth, 'MMMM yyyy', { locale: th })}
                onPrev={() => setCurrentMonth(prev => addDays(startOfMonth(prev), -1))}
                onNext={() => setCurrentMonth(prev => addDays(endOfMonth(prev), 1))}
                prevLabel="เดือนก่อน"
                nextLabel="เดือนถัดไป"
              />
            </div>

            {/* ตอนโหลดต้องเห็นว่ากำลังโหลด ของเดิมขึ้นปฏิทินว่างเปล่าแล้วข้อมูล
                โผล่มาเฉย ๆ คนใช้นึกว่าไม่มีใครเกิดเดือนนี้ */}
            {loading && (
              <div className="grid grid-cols-7 gap-2" aria-busy="true" aria-label="กำลังโหลดวันเกิด">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 35 }).map((_, idx) => (
                  <div key={idx} className="aspect-square rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            )}

            {/* Calendar Grid */}
            <div className={`grid grid-cols-7 gap-2 ${loading ? 'hidden' : ''}`}>
              {/* Weekday Headers */}
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                  {day}
                </div>
              ))}
              
              {/* Empty cells for days before month starts */}
              {Array.from({ length: monthStart.getDay() }).map((_, idx) => (
                <div key={`empty-${idx}`} className="aspect-square" />
              ))}
              
              {/* Calendar Days */}
              {calendarDays.map((day, idx) => {
                const dayBirthdays = getBirthdaysForDay(day);
                const hasBirthday = dayBirthdays.length > 0;
                const isCurrentDay = isToday(day);
                
                return (
                  <div
                    key={idx}
                    className={`
                      relative aspect-square p-2 rounded-lg border
                      ${isCurrentDay ? 'bg-red-50 border-red-300' : 'border-gray-200'}
                      ${hasBirthday ? 'bg-[var(--pink-50)] cursor-pointer hover:bg-[var(--pink-100)]' : ''}
                      transition-colors
                    `}
                    onClick={() => hasBirthday && handleDateClick(day)}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {getDate(day)}
                    </div>
                    
                    {hasBirthday && (
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="flex -space-x-2">
                          {dayBirthdays.slice(0, 3).map((user, i) => (
                            <img
                              key={user.id}
                              src={`/api/avatar/${user.id}`}
                              alt={user.fullName}
                              className="w-6 h-6 rounded-full border-2 border-white"
                              title={user.fullName}
                            />
                          ))}
                          {dayBirthdays.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-[var(--grape-500)] text-white text-xs flex items-center justify-center border-2 border-white">
                              +{dayBirthdays.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {hasBirthday && (
                      <div className="absolute top-1 right-1">
                        <Gift className="w-4 h-4 text-pink-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Birthday count for month */}
            {monthBirthdays.length > 0 && (
              <div className="mt-4 pt-4 border-t text-center">
                <p className="text-sm text-gray-600">
                  วันเกิดในเดือนนี้ทั้งหมด {monthBirthdays.length} คน
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Upcoming Birthdays */}
        <div className="space-y-6">
          {/* Upcoming Birthdays */}
          <Card padding={0}>
            <CardHeader>
              <CardTitle icon={PartyPopper} tone="grape">
                วันเกิดใกล้ถึง (±5 วัน)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingBirthdays.length > 0 ? (
                <ListRows>
                  {upcomingBirthdays.map(user => {
                    const birthdayThisYear = new Date(
                      new Date().getFullYear(),
                      user.birthDate.getMonth(),
                      user.birthDate.getDate()
                    );
                    const isToday = isSameDay(birthdayThisYear, new Date());
                    const daysUntil = Math.ceil((birthdayThisYear.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <ListRow
                        key={user.id}
                        leading={<UserAvatar name={user.fullName} userId={user.id} size="lg" />}
                        title={user.fullName}
                        meta={
                          <>
                            {format(birthdayThisYear, 'dd MMMM', { locale: th })}
                            {isToday && <span className="text-[var(--pink-700)] font-medium ml-2">🎉 วันนี้!</span>}
                            {daysUntil > 0 && daysUntil <= 5 && (
                              <span className="text-[var(--grape-700)] ml-2">อีก {daysUntil} วัน</span>
                            )}
                            {daysUntil < 0 && daysUntil >= -5 && (
                              <span className="text-gray-500 ml-2">{Math.abs(daysUntil)} วันที่แล้ว</span>
                            )}
                          </>
                        }
                        trailing={isToday ? <Pill tone="pink">HBD!</Pill> : undefined}
                      />
                    );
                  })}
                </ListRows>
              ) : (
                <EmptyState icon={<Gift size={40} />} title="ไม่มีวันเกิดในช่วงนี้" />
              )}
            </CardContent>
          </Card>

          {/* All Birthdays in Month */}
          {monthBirthdays.length > 0 && (
            <Card padding={0}>
              <CardHeader>
                <CardTitle icon={Cake} tone="pink">
                  วันเกิดทั้งหมดในเดือนนี้
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ListRows className="max-h-[300px] overflow-y-auto">
                  {monthBirthdays.map(user => (
                    <ListRow
                      key={user.id}
                      leading={<UserAvatar name={user.fullName} userId={user.id} size="sm" />}
                      title={user.fullName}
                      trailing={
                        <span className="text-sm text-gray-600">
                          {format(user.birthDate, 'dd MMM', { locale: th })}
                        </span>
                      }
                    />
                  ))}
                </ListRows>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Birthday Dialog */}
      <Modal
        open={showBirthdayDialog}
        onClose={() => setShowBirthdayDialog(false)}
        title={
          <span className="flex items-center gap-2">
            <Cake className="w-5 h-5 text-[var(--pink-500)]" />
            วันเกิดวันที่ {selectedDate && format(selectedDate, 'dd MMMM', { locale: th })}
          </span>
        }
      >
          <div className="space-y-4 mt-4">
            {selectedDate && getBirthdaysForDay(selectedDate).map(user => {
              const age = new Date().getFullYear() - user.birthDate.getFullYear();
              return (
                <InfoPanel key={user.id} tone="pink" className="flex items-center gap-4">
                  <UserAvatar name={user.fullName} userId={user.id} size="lg" className="border-2 border-white shadow-md" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{user.fullName}</h3>
                    <p className="text-sm text-gray-600">
                      {user.role === 'manager' ? 'ผู้จัดการ' : 
                       user.role === 'hr' ? 'ฝ่ายบุคคล' : 
                       user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                    </p>
                    <p className="text-sm text-[var(--grape-700)] font-medium mt-1">
                      อายุ {age} ปี
                    </p>
                  </div>
                  {isSameDay(selectedDate, new Date()) && (
                    <div className="text-2xl animate-bounce">🎉</div>
                  )}
                </InfoPanel>
              );
            })}
          </div>
        </Modal>
    </div>
  );
}