// lib/maps.ts
//
// ตัวเลือกสำหรับโหลด Google Maps — ที่เดียวสำหรับทั้งระบบ
//
// ⚠️ ทำไมต้องรวมไว้ที่เดียว
// @react-google-maps/api โหลดสคริปต์ครั้งเดียวต่อ id แล้วแชร์กันทุกคอมโพเนนต์
// ถ้ามีที่ไหนส่ง options ไม่ตรงกับที่โหลดไปแล้ว มันจะพัง:
//   "Loader must not be called again with different options"
//
// เคสจริงที่เจอ: หน้าแผนที่ทุกหน้าใช้ค่าคงที่ระดับโมดูล แต่ CheckInMap
// เขียน libraries: ['places'] ไว้ในตัวคอมโพเนนต์ ซึ่งสร้าง array ใหม่
// ทุกครั้งที่ render → ตัวโหลดมองว่าเป็นคนละ options → แผนที่พังทั้งระบบ
//
// นำเข้าค่าคงที่ตัวนี้เสมอ อย่าเขียน options เองในคอมโพเนนต์

import type { Libraries } from '@react-google-maps/api'

/** ต้องเป็นค่าคงที่ระดับโมดูล ห้ามสร้าง array ใหม่ตอน render */
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places']

export const GOOGLE_MAPS_LOADER = {
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  libraries: GOOGLE_MAPS_LIBRARIES,
  id: 'google-map-script',
  language: 'th',
  region: 'TH',
} as const
