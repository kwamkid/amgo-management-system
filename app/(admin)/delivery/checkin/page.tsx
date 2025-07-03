'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useDeliveryPoints, useCameraCapture } from '@/hooks/useDelivery'
import { CreateDeliveryPointData } from '@/types/delivery'
import { getCurrentLocation, getAddressFromCoords } from '@/lib/utils/location'
import { 
  Camera, 
  MapPin, 
  ArrowLeft,
  RotateCcw,
  Save,
  Loader2,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'

const mapContainerStyle = {
  width: '100%',
  height: '300px'
}

const libraries: ("places")[] = ['places']

export default function DeliveryCheckInPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { createDeliveryPoint } = useDeliveryPoints()
  const { 
    isCapturing, 
    stream, 
    capturedPhoto, 
    startCamera, 
    capturePhoto, 
    reset 
  } = useCameraCapture()
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [address, setAddress] = useState<string>('')
  const [note, setNote] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

    const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
    id: 'google-map-script',
    language: 'th',
    region: 'TH'
    })

  // Check if user is driver
  useEffect(() => {
    if (userData && userData.role !== 'driver' && userData.role !== 'admin') {
      router.push('/unauthorized')
    }
  }, [userData, router])

  // Setup video stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // Get current location
  const getLocation = async () => {
    setIsGettingLocation(true)
    setLocationError(null)
    
    try {
      const locationData = await getCurrentLocation()
      setLocation({
        lat: locationData.lat,
        lng: locationData.lng
      })
      
      // Get address from coordinates
      if (isLoaded) {
        try {
          const addr = await getAddressFromCoords(locationData.lat, locationData.lng)
          setAddress(addr)
        } catch (error) {
          console.error('Error getting address:', error)
          setAddress('')
        }
      }
    } catch (error) {
      setLocationError((error as Error).message || 'ไม่สามารถระบุตำแหน่งได้')
    } finally {
      setIsGettingLocation(false)
    }
  }

  // Auto get location on mount
  useEffect(() => {
    getLocation()
  }, [isLoaded])

  // Handle capture
  const handleCapture = () => {
    if (videoRef.current) {
      capturePhoto(videoRef.current)
    }
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!location) {
      setLocationError('กรุณาระบุตำแหน่งปัจจุบัน')
      return
    }

    if (!capturedPhoto) {
      alert('กรุณาถ่ายรูปหลักฐานการส่งของ')
      return
    }

    setIsSubmitting(true)

    try {
      const deliveryData: CreateDeliveryPointData = {
        lat: location.lat,
        lng: location.lng,
        deliveryType: 'delivery', // Default to delivery
        note: note || undefined,
        photoCaptureData: capturedPhoto
      }

      const deliveryId = await createDeliveryPoint(deliveryData)
      
      if (deliveryId) {
        router.push('/delivery')
      }
    } catch (error) {
      console.error('Error creating delivery point:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/delivery"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">เช็คอินจุดส่งของ</h1>
          <p className="text-gray-600 mt-1">บันทึกการส่งสินค้า</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Location Card with Map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-600" />
              ตำแหน่งปัจจุบัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {locationError && (
              <Alert variant="error" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{locationError}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-4">
              {/* Google Map */}
              {isLoaded && location ? (
                <div className="rounded-lg overflow-hidden border">
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={location}
                    zoom={17}
                    options={{
                      streetViewControl: false,
                      mapTypeControl: false,
                      fullscreenControl: false,
                      zoomControl: true
                    }}
                  >
                    <Marker position={location} />
                  </GoogleMap>
                </div>
              ) : (
                <div className="h-[300px] bg-gray-100 rounded-lg flex items-center justify-center">
                  {loadError ? (
                    <p className="text-red-600">Error loading map</p>
                  ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  )}
                </div>
              )}

              {/* Address */}
              {address && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">ที่อยู่:</p>
                  <p className="text-sm font-medium mt-1">{address}</p>
                </div>
              )}

              {/* Update Location Button */}
              <Button
                type="button"
                onClick={getLocation}
                disabled={isGettingLocation}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {isGettingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <MapPin className="w-4 h-4 mr-2" />
                )}
                อัพเดทตำแหน่ง
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Photo Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="w-5 h-5 text-red-600" />
              ถ่ายรูปหลักฐาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!capturedPhoto && !isCapturing && (
                <Button
                  type="button"
                  onClick={startCamera}
                  className="w-full"
                  size="lg"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  เปิดกล้องถ่ายรูป
                </Button>
              )}

              {isCapturing && (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg"
                  />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                    <Button
                      type="button"
                      onClick={handleCapture}
                      size="lg"
                      className="bg-white text-gray-900 hover:bg-gray-100"
                    >
                      <Camera className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
              )}

              {capturedPhoto && (
                <div className="relative">
                  <img
                    src={capturedPhoto}
                    alt="Captured"
                    className="w-full rounded-lg"
                  />
                  <Button
                    type="button"
                    onClick={reset}
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    ถ่ายใหม่
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Note */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">หมายเหตุ (ถ้ามี)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ลูกค้าไม่อยู่ ฝากไว้กับยาม..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting || !capturedPhoto || !location}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              บันทึกการส่ง
            </>
          )}
        </Button>
      </form>
    </div>
  )
}