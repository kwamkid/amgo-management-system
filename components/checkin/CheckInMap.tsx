// components/checkin/CheckInMap.tsx

'use client'

import { useEffect, useState } from 'react'
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api'
import { LocationCheckResult } from '@/types/checkin'
import { useLocations } from '@/hooks/useLocations'
import { GOOGLE_MAPS_LOADER } from '@/lib/maps'
import { Spinner } from '@/components/aoo'

interface CheckInMapProps {
  userLat: number
  userLng: number
  locationCheckResult: LocationCheckResult | null
  zoom?: number
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

// ── หมุดบนแผนที่ (เจ้าของขอ 6 ต.ค. 69) ───────────────────────────────────
// เดิมตัวเรา = จุดฟ้าเล็ก · สาขา = ลูกศรแดง → คนดูนึกว่าลูกศรคือตัวเอง
// ใหม่: ตัวเรา = หมุดหยดน้ำสีแดง (สีนำ) มีไอคอนคน ใหญ่และอยู่บนสุด
//       สาขา = ป้ายไอคอนตึก · เขียว = อยู่ในเขต · เทาเข้ม = อยู่นอกเขต (ไม่ใช้แดงซ้ำกับตัวเรา)
// Google Maps รับค่าสีจริงเท่านั้น จึงต้องเขียนค่าเดียวกับ token ใน globals.css ไว้ตรงนี้
const COLOR_ME = '#F03D0E' // --brand-coral-500 (แดงนำ)
const COLOR_IN = '#14532D' // --leaf-500 (เขียว Forest)
const COLOR_OUT = '#3E3530' // --color-gray-700

const svgUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

/** หมุดหยดน้ำ + ไอคอนคน (lucide user) */
const meIcon = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56">
  <path d="M22 54c0 0 19-17.6 19-32.5C41 10.7 32.5 3 22 3S3 10.7 3 21.5C3 36.4 22 54 22 54z" fill="${COLOR_ME}" stroke="#fff" stroke-width="3"/>
  <g transform="translate(10 9.5)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="7" r="4"/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
  </g></svg>`)

/** ป้ายสี่เหลี่ยม + ไอคอนตึก (lucide building-2) */
const officeIcon = (color: string) =>
  svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="38" height="44" viewBox="0 0 38 44">
  <path d="M19 43l-6-7h12z" fill="${color}"/>
  <rect x="2" y="2" width="34" height="34" rx="10" fill="${color}" stroke="#fff" stroke-width="3"/>
  <g transform="translate(7 7)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>
  </g></svg>`)


export default function CheckInMap({ 
  userLat, 
  userLng, 
  locationCheckResult,
  zoom = 17 
}: CheckInMapProps) {
  const { locations } = useLocations(true)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  
  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER)

  const center = {
    lat: userLat,
    lng: userLng
  }

  useEffect(() => {
    if (map && locationCheckResult?.nearestLocation) {
      // Only fit bounds if the nearest location is far away
      const nearestLoc = locations.find(l => l.id === locationCheckResult.nearestLocation?.id)
      if (nearestLoc) {
        const distance = locationCheckResult.nearestLocation.distance
        
        // Only adjust view if location is more than 500 meters away
        if (distance > 500) {
          const bounds = new google.maps.LatLngBounds()
          bounds.extend({ lat: userLat, lng: userLng })
          bounds.extend({ lat: nearestLoc.lat, lng: nearestLoc.lng })
          
          map.fitBounds(bounds)
          
          // Add some padding
          const padding = { top: 100, right: 50, bottom: 200, left: 50 }
          map.fitBounds(bounds, padding)
        }
        // Otherwise keep the original zoom level
      }
    }
  }, [map, locationCheckResult, userLat, userLng, locations])

  if (loadError) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <p className="text-sm text-[var(--ruby-700)]">Error loading map</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <Spinner size="md" />
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={zoom}
      onLoad={(map) => setMap(map)}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: false,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      }}
    >
      {/* ตัวเรา — วาดหลังสาขาและ zIndex สูงสุด ให้อยู่บนสุดเสมอ */}
      <Circle
        center={center}
        radius={30}
        options={{
          fillColor: COLOR_ME,
          fillOpacity: 0.12,
          strokeColor: COLOR_ME,
          strokeOpacity: 0.35,
          strokeWeight: 1,
        }}
      />
      <Marker
        position={center}
        title="ตำแหน่งของคุณ"
        zIndex={1000}
        icon={{
          url: meIcon,
          scaledSize: new google.maps.Size(44, 56),
          anchor: new google.maps.Point(22, 54),
        }}
      />

      {/* Location Markers and Radius */}
      {locations.map((location) => {
        const isInRange = locationCheckResult?.locationsInRange.some(l => l.id === location.id)
        
        return (
          <div key={location.id}>
            {/* Location Marker */}
            <Marker
              position={{ lat: location.lat, lng: location.lng }}
              title={location.name}
              zIndex={10}
              icon={{
                url: officeIcon(isInRange ? COLOR_IN : COLOR_OUT),
                scaledSize: new google.maps.Size(38, 44),
                anchor: new google.maps.Point(19, 43),
              }}
            />
            
            {/* Geofence Circle */}
            <Circle
              center={{ lat: location.lat, lng: location.lng }}
              radius={location.radius}
              options={{
                fillColor: isInRange ? COLOR_IN : COLOR_OUT,
                fillOpacity: isInRange ? 0.14 : 0.06,
                strokeColor: isInRange ? COLOR_IN : COLOR_OUT,
                strokeOpacity: isInRange ? 0.7 : 0.4,
                strokeWeight: 2,
              }}
            />
          </div>
        )
      })}
    </GoogleMap>
  )
}