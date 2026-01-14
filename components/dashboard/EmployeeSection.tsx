// ========== FILE: components/dashboard/EmployeeSection.tsx ==========
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Calendar,
  Clock,
  Cake,
  Gift,
  PartyPopper,
  LogIn,
  User,
  CheckCircle,
  MapPin
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserData } from '@/hooks/useAuth';
import { useCheckIn } from '@/hooks/useCheckIn';
import { format, addDays, isSameDay, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, getDate, isToday } from 'date-fns';
import { th } from 'date-fns/locale';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

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
  const router = useRouter();
  const { currentCheckIn } = useCheckIn();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBirthdayDialog, setShowBirthdayDialog] = useState(false);
  
  // Get birthdays for the current month
  useEffect(() => {
    const fetchBirthdays = async () => {
      try {
        setLoading(true);
        const usersSnapshot = await getDocs(
          query(collection(db, 'users'), where('isActive', '==', true))
        );
        
        const birthdayUsers: BirthdayUser[] = [];
        
        usersSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.birthDate) {
            // Convert birthDate to Date
            let birthDate: Date;
            if (data.birthDate.toDate) {
              birthDate = data.birthDate.toDate();
            } else if (data.birthDate.seconds) {
              birthDate = new Date(data.birthDate.seconds * 1000);
            } else {
              birthDate = new Date(data.birthDate);
            }
            
            // Check if birthday is in current month
            const birthMonth = birthDate.getMonth();
            const currentMonthNum = currentMonth.getMonth();
            
            if (birthMonth === currentMonthNum) {
              birthdayUsers.push({
                id: doc.id,
                fullName: data.fullName,
                lineDisplayName: data.lineDisplayName,
                linePictureUrl: data.linePictureUrl,
                birthDate,
                role: data.role,
                locationIds: data.allowedLocationIds
              });
            }
          }
        });
        
        // Sort by birth date
        birthdayUsers.sort((a, b) => a.birthDate.getDate() - b.birthDate.getDate());
        setBirthdays(birthdayUsers);
      } catch (error) {
        console.error('Error fetching birthdays:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBirthdays();
  }, [currentMonth]);
  
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
  
  // Get birthdays for a specific day
  const getBirthdaysForDay = (day: Date) => {
    return birthdays.filter(user => user.birthDate.getDate() === day.getDate());
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
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle className="text-xl font-medium flex items-center gap-2">
              <Cake className="w-6 h-6 text-pink-600" />
              ปฏิทินวันเกิดพนักงาน
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setCurrentMonth(prev => addDays(startOfMonth(prev), -1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <h3 className="text-lg font-semibold">
                {format(currentMonth, 'MMMM yyyy', { locale: th })}
              </h3>
              
              <button
                onClick={() => setCurrentMonth(prev => addDays(endOfMonth(prev), 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
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
                      ${hasBirthday ? 'bg-gradient-to-br from-pink-50 to-purple-50 cursor-pointer hover:from-pink-100 hover:to-purple-100' : ''}
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
                              src={user.linePictureUrl || '/avatar-placeholder.png'}
                              alt={user.fullName}
                              className="w-6 h-6 rounded-full border-2 border-white"
                              title={user.fullName}
                            />
                          ))}
                          {dayBirthdays.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center border-2 border-white">
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
            {birthdays.length > 0 && (
              <div className="mt-4 pt-4 border-t text-center">
                <p className="text-sm text-gray-600">
                  วันเกิดในเดือนนี้ทั้งหมด {birthdays.length} คน
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Quick Actions & Upcoming Birthdays */}
        <div className="space-y-6">
          {/* Check-in Status & Quick Action */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-100">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-600" />
                สถานะการทำงาน
              </h3>
              
              {currentCheckIn ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-base font-medium text-green-700">กำลังทำงาน</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800 mb-2">
                      เช็คอิน {format(new Date(currentCheckIn.checkinTime), 'HH:mm')}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4" />
                      {currentCheckIn.primaryLocationName || 'เช็คอินนอกสถานที่'}
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/checkin')}
                  >
                    ไปหน้าเช็คอิน/เช็คเอาท์
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <p className="text-base font-medium text-orange-800 mb-1">ยังไม่ได้เช็คอิน</p>
                    <p className="text-sm text-orange-600">กรุณาเช็คอินเพื่อเริ่มงาน</p>
                  </div>
                  
                  <Button 
                    className="w-full bg-slate-700 hover:bg-slate-800 text-white"
                    onClick={() => router.push('/checkin')}
                    size="lg"
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    เช็คอินเลย
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Birthdays */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-pink-50 to-purple-100">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <PartyPopper className="w-5 h-5 text-purple-600" />
                วันเกิดใกล้ถึง (±5 วัน)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingBirthdays.length > 0 ? (
                <div className="space-y-3">
                  {upcomingBirthdays.map(user => {
                    const birthdayThisYear = new Date(
                      new Date().getFullYear(),
                      user.birthDate.getMonth(),
                      user.birthDate.getDate()
                    );
                    const isToday = isSameDay(birthdayThisYear, new Date());
                    const daysUntil = Math.ceil((birthdayThisYear.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={user.id} className="flex items-center gap-3 p-3 bg-white rounded-lg">
                        <img
                          src={user.linePictureUrl || '/avatar-placeholder.png'}
                          alt={user.fullName}
                          className="w-12 h-12 rounded-full"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {user.fullName}
                          </p>
                          <p className="text-sm text-gray-600">
                            {format(birthdayThisYear, 'dd MMMM', { locale: th })}
                            {isToday && <span className="text-pink-600 font-medium ml-2">🎉 วันนี้!</span>}
                            {daysUntil > 0 && daysUntil <= 5 && (
                              <span className="text-purple-600 ml-2">อีก {daysUntil} วัน</span>
                            )}
                            {daysUntil < 0 && daysUntil >= -5 && (
                              <span className="text-gray-500 ml-2">{Math.abs(daysUntil)} วันที่แล้ว</span>
                            )}
                          </p>
                        </div>
                        {isToday && (
                          <Badge className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                            HBD!
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">ไม่มีวันเกิดในช่วงนี้</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* All Birthdays in Month */}
          {birthdays.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Cake className="w-5 h-5 text-pink-600" />
                  วันเกิดทั้งหมดในเดือนนี้
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {birthdays.map(user => (
                    <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                      <img
                        src={user.linePictureUrl || '/avatar-placeholder.png'}
                        alt={user.fullName}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{user.fullName}</p>
                      </div>
                      <span className="text-sm text-gray-600">
                        {format(user.birthDate, 'dd MMM', { locale: th })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Birthday Dialog */}
      <Dialog open={showBirthdayDialog} onOpenChange={setShowBirthdayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cake className="w-5 h-5 text-pink-600" />
              วันเกิดวันที่ {selectedDate && format(selectedDate, 'dd MMMM', { locale: th })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedDate && getBirthdaysForDay(selectedDate).map(user => {
              const age = new Date().getFullYear() - user.birthDate.getFullYear();
              return (
                <div key={user.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg">
                  <img
                    src={user.linePictureUrl || '/avatar-placeholder.png'}
                    alt={user.fullName}
                    className="w-16 h-16 rounded-full border-2 border-white shadow-md"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{user.fullName}</h3>
                    <p className="text-sm text-gray-600">
                      {user.role === 'manager' ? 'ผู้จัดการ' : 
                       user.role === 'hr' ? 'ฝ่ายบุคคล' : 
                       user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                    </p>
                    <p className="text-sm text-purple-600 font-medium mt-1">
                      อายุ {age} ปี
                    </p>
                  </div>
                  {isSameDay(selectedDate, new Date()) && (
                    <div className="text-2xl animate-bounce">🎉</div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}