// components/checkin/CheckInMap.tsx

'use client'

import { useEffect, useState } from 'react'
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api'
import { LocationCheckResult } from '@/types/checkin'
import { useLocations } from '@/hooks/useLocations'

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

const libraries: ("places")[] = ['places']

export default function CheckInMap({ 
  userLat, 
  userLng, 
  locationCheckResult,
  zoom = 17 
}: CheckInMapProps) {
  const { locations } = useLocations(true)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries
  })

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
        <p className="text-red-600">Error loading map</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading map...</p>
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
      {/* User Marker */}
      <Marker 
        position={center}
        icon={{
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#3B82F6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3
        }}
      />
      
      {/* User Accuracy Circle */}
      <Circle
        center={center}
        radius={30}
        options={{
          fillColor: '#3B82F6',
          fillOpacity: 0.1,
          strokeColor: '#3B82F6',
          strokeOpacity: 0.3,
          strokeWeight: 1
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
              icon={{
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: isInRange ? '#16A34A' : '#DC2626',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                rotation: 180
              }}
            />
            
            {/* Geofence Circle */}
            <Circle
              center={{ lat: location.lat, lng: location.lng }}
              radius={location.radius}
              options={{
                fillColor: isInRange ? '#16A34A' : '#DC2626',
                fillOpacity: 0.1,
                strokeColor: isInRange ? '#16A34A' : '#DC2626',
                strokeOpacity: 0.5,
                strokeWeight: 2,
              }}
            />
          </div>
        )
      })}
    </GoogleMap>
  )
}