// app/api/holidays/public/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { PublicHolidayImport } from '@/types/holiday'

// Thailand Public Holidays Data
const THAILAND_PUBLIC_HOLIDAYS: Record<number, PublicHolidayImport[]> = {
  2024: [
    { name: "วันขึ้นปีใหม่", date: "2024-01-01" },
    { name: "วันตรุษจีน", date: "2024-02-10" },
    { name: "วันมาฆบูชา", date: "2024-02-24" },
    { name: "วันจักรี", date: "2024-04-06" },
    { name: "วันสงกรานต์", date: "2024-04-13" },
    { name: "วันสงกรานต์", date: "2024-04-14" },
    { name: "วันสงกรานต์", date: "2024-04-15" },
    { name: "วันฉัตรมงคล", date: "2024-05-04" },
    { name: "วันวิสาขบูชา", date: "2024-05-22" },
    { name: "วันอาสาฬหบูชา", date: "2024-07-20" },
    { name: "วันเข้าพรรษา", date: "2024-07-21" },
    { name: "วันเฉลิมพระชนมพรรษา ร.10", date: "2024-07-28" },
    { name: "วันแม่แห่งชาติ", date: "2024-08-12" },
    { name: "วันปิยมหาราช", date: "2024-10-23" },
    { name: "วันพ่อแห่งชาติ", date: "2024-12-05" },
    { name: "วันรัฐธรรมนูญ", date: "2024-12-10" },
    { name: "วันสิ้นปี", date: "2024-12-31" }
  ],
  2025: [
    { name: "วันขึ้นปีใหม่", date: "2025-01-01" },
    { name: "วันตรุษจีน", date: "2025-01-29" },
    { name: "วันมาฆบูชา", date: "2025-02-12" },
    { name: "วันจักรี", date: "2025-04-06" },
    { name: "วันสงกรานต์", date: "2025-04-13" },
    { name: "วันสงกรานต์", date: "2025-04-14" },
    { name: "วันสงกรานต์", date: "2025-04-15" },
    { name: "วันแรงงานแห่งชาติ", date: "2025-05-01" },
    { name: "วันฉัตรมงคล", date: "2025-05-04" },
    { name: "วันวิสาขบูชา", date: "2025-05-11" },
    { name: "วันอาสาฬหบูชา", date: "2025-07-09" },
    { name: "วันเข้าพรรษา", date: "2025-07-10" },
    { name: "วันเฉลิมพระชนมพรรษา ร.10", date: "2025-07-28" },
    { name: "วันแม่แห่งชาติ", date: "2025-08-12" },
    { name: "วันปิยมหาราช", date: "2025-10-23" },
    { name: "วันพ่อแห่งชาติ", date: "2025-12-05" },
    { name: "วันรัฐธรรมนูญ", date: "2025-12-10" },
    { name: "วันสิ้นปี", date: "2025-12-31" }
  ],
  2026: [
    { name: "วันขึ้นปีใหม่", date: "2026-01-01" },
    { name: "วันตรุษจีน", date: "2026-02-17" },
    { name: "วันมาฆบูชา", date: "2026-03-03" },
    { name: "วันจักรี", date: "2026-04-06" },
    { name: "วันสงกรานต์", date: "2026-04-13" },
    { name: "วันสงกรานต์", date: "2026-04-14" },
    { name: "วันสงกรานต์", date: "2026-04-15" },
    { name: "วันแรงงานแห่งชาติ", date: "2026-05-01" },
    { name: "วันฉัตรมงคล", date: "2026-05-04" },
    { name: "วันวิสาขบูชา", date: "2026-05-30" },
    { name: "วันอาสาฬหบูชา", date: "2026-07-28" },
    { name: "วันเข้าพรรษา", date: "2026-07-29" },
    { name: "วันเฉลิมพระชนมพรรษา ร.10", date: "2026-07-28" },
    { name: "วันแม่แห่งชาติ", date: "2026-08-12" },
    { name: "วันปิยมหาราช", date: "2026-10-23" },
    { name: "วันพ่อแห่งชาติ", date: "2026-12-05" },
    { name: "วันรัฐธรรมนูญ", date: "2026-12-10" },
    { name: "วันสิ้นปี", date: "2026-12-31" }
  ]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = searchParams.get('year')
    
    if (!year || isNaN(Number(year))) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      )
    }
    
    const yearNum = Number(year)
    
    // Check if we have data for the requested year
    if (THAILAND_PUBLIC_HOLIDAYS[yearNum]) {
      return NextResponse.json(THAILAND_PUBLIC_HOLIDAYS[yearNum])
    }
    
    // Try to fetch from external API if available
    try {
      // You can integrate with real Thai holiday API here
      // For example: https://data.go.th/dataset/public-holiday
      
      // For now, return empty array if year not in our data
      return NextResponse.json([])
    } catch (error) {
      console.error('Error fetching from external API:', error)
      return NextResponse.json([])
    }
    
  } catch (error) {
    console.error('Error in public holidays API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}