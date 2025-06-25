// components/locations/LocationMapPicker.tsx

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { GoogleMap, Marker, Circle, useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api'
import { MapPin, Search } from 'lucide-react'

interface LocationMapPickerProps {
  lat: number
  lng: number
  radius: number
  onLocationChange: (lat: number, lng: number) => void
  onAddressChange?: (address: string) => void
}

const mapContainerStyle = {
  width: '100%',
  height: '400px'
}

const defaultCenter = {
  lat: 13.7563, // Bangkok
  lng: 100.5018
}

const libraries: ("places")[] = ['places']

export default function LocationMapPicker({
  lat,
  lng,
  radius,
  onLocationChange,
  onAddressChange
}: LocationMapPickerProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null)
  const [marker, setMarker] = useState({ lat: lat || defaultCenter.lat, lng: lng || defaultCenter.lng })
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries
  })

  // Update marker when props change
  useEffect(() => {
    if (lat && lng && lat !== 0 && lng !== 0) {
      setMarker({ lat, lng })
    }
  }, [lat, lng])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
  }, [])

  const onMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newLat = event.latLng.lat()
      const newLng = event.latLng.lng()
      setMarker({ lat: newLat, lng: newLng })
      onLocationChange(newLat, newLng)
      
      // Reverse geocoding to get address
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          onAddressChange?.(results[0].formatted_address)
        }
      })
    }
  }, [onLocationChange, onAddressChange])

  const onMarkerDragEnd = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newLat = event.latLng.lat()
      const newLng = event.latLng.lng()
      setMarker({ lat: newLat, lng: newLng })
      onLocationChange(newLat, newLng)
      
      // Reverse geocoding to get address
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          onAddressChange?.(results[0].formatted_address)
        }
      })
    }
  }, [onLocationChange, onAddressChange])

  const onSearchBoxLoad = useCallback((ref: google.maps.places.SearchBox) => {
    searchBoxRef.current = ref
  }, [])

  const onPlacesChanged = useCallback(() => {
    const searchBox = searchBoxRef.current
    if (searchBox) {
      const places = searchBox.getPlaces()
      if (places && places.length > 0) {
        const place = places[0]
        if (place.geometry && place.geometry.location) {
          const newLat = place.geometry.location.lat()
          const newLng = place.geometry.location.lng()
          setMarker({ lat: newLat, lng: newLng })
          onLocationChange(newLat, newLng)
          
          if (place.formatted_address) {
            onAddressChange?.(place.formatted_address)
          }
          
          // Center map to new location
          if (map) {
            map.panTo({ lat: newLat, lng: newLng })
            map.setZoom(17)
          }
        }
      }
    }
  }, [map, onLocationChange, onAddressChange])

  if (loadError) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-red-600">Error loading maps</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search Box */}
      <StandaloneSearchBox
        onLoad={onSearchBoxLoad}
        onPlacesChanged={onPlacesChanged}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="ค้นหาสถานที่..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900 text-base"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
          />
        </div>
      </StandaloneSearchBox>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-gray-200">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={marker}
          zoom={15}
          onLoad={onMapLoad}
          onClick={onMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false
          }}
        >
          {/* Marker */}
          <Marker 
            position={marker}
            draggable={true}
            onDragEnd={onMarkerDragEnd}
          />
          
          {/* Radius Circle */}
          <Circle
            center={marker}
            radius={radius}
            options={{
              fillColor: '#ef4444',
              fillOpacity: 0.1,
              strokeColor: '#ef4444',
              strokeOpacity: 0.8,
              strokeWeight: 2
            }}
          />
        </GoogleMap>
      </div>

      {/* Instructions */}
      <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
        <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
        <div className="text-sm text-gray-600">
          <p>• คลิกบนแผนที่เพื่อเลือกตำแหน่งใหม่</p>
          <p>• ลากหมุดเพื่อย้ายตำแหน่ง</p>
          <p>• ค้นหาด้วยชื่อสถานที่ในช่องค้นหา</p>
          <p className="mt-1">วงกลมสีแดงแสดงรัศมี {radius} เมตร สำหรับการเช็คอิน</p>
        </div>
      </div>
    </div>
  )
}