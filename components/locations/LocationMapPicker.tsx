// components/locations/LocationMapPicker.tsx

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { GoogleMap, Marker, Circle, useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api'
import { MapPin, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

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
  const inputRef = useRef<HTMLInputElement | null>(null)
  
  // Use local state for marker position
  const [markerPosition, setMarkerPosition] = useState({ 
    lat: lat || defaultCenter.lat, 
    lng: lng || defaultCenter.lng 
  })
  
 const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
    id: 'google-map-script'
  })

  // Log for debugging
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API Key is missing!')
    }
  }, [])

  // Update marker when props change
  useEffect(() => {
    if (lat && lng && lat !== 0 && lng !== 0) {
      setMarkerPosition({ lat, lng })
      
      // Pan map to new position if map is loaded
      if (map) {
        map.panTo({ lat, lng })
      }
    }
  }, [lat, lng, map])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
    
    // Set initial center if we have coordinates
    if (lat && lng && lat !== 0 && lng !== 0) {
      map.setCenter({ lat, lng })
      map.setZoom(17)
    }
  }, [lat, lng])

  const onMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newLat = event.latLng.lat()
      const newLng = event.latLng.lng()
      
      // Update local state
      setMarkerPosition({ lat: newLat, lng: newLng })
      
      // Notify parent
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
      
      // Update local state
      setMarkerPosition({ lat: newLat, lng: newLng })
      
      // Notify parent
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
          
          // Update local state
          setMarkerPosition({ lat: newLat, lng: newLng })
          
          // Notify parent
          onLocationChange(newLat, newLng)
          
          if (place.formatted_address) {
            onAddressChange?.(place.formatted_address)
          }
          
          // Center and zoom map to new location
          if (map) {
            map.setCenter({ lat: newLat, lng: newLng })
            map.setZoom(17)
          }
        }
      }
    }
  }, [map, onLocationChange, onAddressChange])

  if (loadError) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-8 text-center">
          <p className="text-red-600">Error loading maps</p>
        </CardContent>
      </Card>
    )
  }

  if (!isLoaded) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading map...</p>
        </CardContent>
      </Card>
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
          <Input
            ref={inputRef}
            type="text"
            placeholder="ค้นหาสถานที่..."
            className="pl-10"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
          />
        </div>
      </StandaloneSearchBox>

      {/* Map */}
      <Card className="border-gray-200 overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={markerPosition}
          zoom={lat && lng && lat !== 0 && lng !== 0 ? 17 : 15}
          onLoad={onMapLoad}
          onClick={onMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            zoomControl: true
          }}
        >
          {/* Marker */}
          <Marker 
            position={markerPosition}
            draggable={true}
            onDragEnd={onMarkerDragEnd}
            animation={google.maps.Animation.DROP}
          />
          
          {/* Radius Circle */}
          <Circle
            center={markerPosition}
            radius={radius}
            options={{
              fillColor: '#ef4444',
              fillOpacity: 0.15,
              strokeColor: '#ef4444',
              strokeOpacity: 0.8,
              strokeWeight: 2
            }}
          />
        </GoogleMap>
      </Card>

      {/* Instructions */}
      <Alert>
        <MapPin className="h-4 w-4" />
        <AlertDescription>
          <ul className="space-y-1 text-sm">
            <li>• คลิกบนแผนที่เพื่อเลือกตำแหน่งใหม่</li>
            <li>• ลากหมุดเพื่อย้ายตำแหน่ง</li>
            <li>• ค้นหาด้วยชื่อสถานที่ในช่องค้นหา</li>
            <li className="text-red-600 font-medium">• วงกลมสีแดงแสดงรัศมี {radius} เมตร สำหรับการเช็คอิน</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}