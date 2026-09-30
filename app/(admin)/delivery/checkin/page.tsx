'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { canSeeDelivery } from '@/lib/services/user/access'
import { useDeliveryPoints, useCameraCapture } from '@/hooks/useDelivery'
import { CreateDeliveryPointData } from '@/types/delivery'
import { getCurrentLocation, getAddressFromCoords } from '@/lib/utils/location'
import { 
  Camera, 
  MapPin, 
  ArrowLeft,
  RotateCcw,
  FileText
} from 'lucide-react'
import Link from 'next/link'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { PageHeader, InfoPanel } from '@/components/shared'
import { useToast } from '@/hooks/useToast'
import { GOOGLE_MAPS_LOADER } from '@/lib/maps'
import { Textarea, Alert, Card, CardContent, CardHeader, CardTitle, Button, Spinner } from '@/components/aoo'
const mapContainerStyle = {
  width: '100%',
  height: '300px'
}


export default function DeliveryCheckInPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { createDeliveryPoint } = useDeliveryPoints()
  const { showToast } = useToast()
  const {
    isCapturing,
    stream,
    capturedPhoto,
    startCamera,
    capturePhoto,
    setPhotoFromFile,
    reset
  } = useCameraCapture()

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [address, setAddress] = useState<string>('')
  const [note, setNote] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

    const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER)

  // Check if user is driver
  useEffect(() => {
    if (userData && !canSeeDelivery(userData)) {
      router.push('/unauthorized')
    }
  }, [userData, router])

  // Setup video stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
      // iOS/WebView บางตัวไม่เริ่มเล่นเองแม้มี autoPlay — สั่งเล่นตรงๆ ไม่งั้นภาพดำ กดถ่ายไม่ได้
      videoRef.current.play().catch(() => {})
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
      showToast('กรุณาถ่ายรูปหลักฐานการส่งของ', 'error')
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
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="เช็คอินจุดส่งของ"
        description="บันทึกการส่งสินค้า"
        icon={Camera}
        backHref="/delivery"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Location Card with Map */}
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={MapPin} tone="sky">
              ตำแหน่งปัจจุบัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {locationError && (
              <Alert tone="error" className="mb-4">
                <div>{locationError}</div>
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
                    <Alert tone="error" compact>Error loading map</Alert>
                  ) : (
                    <Spinner size="md" />
                  )}
                </div>
              )}

              {/* Address */}
              {address && (
                <InfoPanel>
                  <p className="text-sm text-gray-600">ที่อยู่:</p>
                  <p className="text-sm font-medium mt-1">{address}</p>
                </InfoPanel>
              )}

              {/* Update Location Button */}
              <Button type="button" onClick={getLocation} loading={isGettingLocation} variant="soft" size="sm" className="w-full">
                {!isGettingLocation && <MapPin className="w-4 h-4" />}
                อัพเดทตำแหน่ง
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Photo Card */}
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={Camera} tone="accent">
              ถ่ายรูปหลักฐาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!capturedPhoto && !isCapturing && (
                <>
                  <Button type="button" onClick={startCamera} className="w-full" size="lg">
                    <Camera className="w-5 h-5" />
                    เปิดกล้องถ่ายรูป
                  </Button>
                  {/* ทางสำรองเมื่อเบราว์เซอร์ถูกบล็อกสิทธิ์กล้อง — เรียกแอปกล้องของเครื่องแทน */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) setPhotoFromFile(f)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    กล้องไม่ขึ้น? ถ่ายด้วยแอปกล้องของเครื่อง
                  </Button>
                </>
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
                    <Button type="button" onClick={handleCapture} size="lg">
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
                  <Button type="button" onClick={reset} variant="soft" size="sm" className="absolute top-2 right-2">
                    <RotateCcw className="w-4 h-4" />
                    ถ่ายใหม่
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* รายละเอียดการส่ง — เก็บลงช่อง note เดิม (เจ้าของขอไม่ใช้คำว่า "หมายเหตุ") */}
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={FileText} tone="grape">รายละเอียดการส่ง</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ชื่อร้าน · เลขที่บิล · ชื่อลูกค้า — เช่น ร้านป้าแดง บิล 10234 คุณสมชาย ฝากไว้กับยาม"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          loading={isSubmitting}
          icon={isSubmitting ? undefined : 'Save'}
          disabled={!capturedPhoto || !location}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการส่ง'}
        </Button>
      </form>
    </div>
  )
}