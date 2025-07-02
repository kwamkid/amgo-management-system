'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useDeliveryPoints, useCameraCapture } from '@/hooks/useDelivery'
import { CreateDeliveryPointData } from '@/types/delivery'
import { getCurrentLocation } from '@/lib/utils/location'
import { 
  Camera, 
  MapPin, 
  Package, 
  User, 
  Phone,
  Hash,
  ArrowLeft,
  RotateCcw,
  Save,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  
  const [formData, setFormData] = useState<CreateDeliveryPointData>({
    lat: 0,
    lng: 0,
    deliveryType: 'delivery',
    customerName: '',
    customerPhone: '',
    orderNumber: '',
    note: ''
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
      const location = await getCurrentLocation()
      setFormData(prev => ({
        ...prev,
        lat: location.lat,
        lng: location.lng
      }))
    } catch (error) {
      setLocationError('ไม่สามารถระบุตำแหน่งได้ กรุณาเปิด GPS')
    } finally {
      setIsGettingLocation(false)
    }
  }

  // Auto get location on mount
  useEffect(() => {
    getLocation()
  }, [])

  // Handle capture
  const handleCapture = () => {
    if (videoRef.current) {
      capturePhoto(videoRef.current)
    }
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.lat || !formData.lng) {
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
        ...formData,
        photoCaptureData: capturedPhoto
      }

      const deliveryId = await createDeliveryPoint(deliveryData)
      
      if (deliveryId) {
        router.push('/delivery/history')
      }
    } catch (error) {
      console.error('Error creating delivery point:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format phone number
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 10) {
      return numbers
    }
    return numbers.slice(0, 10)
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
          <p className="text-gray-600 mt-1">บันทึกการรับ-ส่งสินค้า</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Location Card */}
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
                <AlertDescription>{locationError}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">พิกัด GPS</p>
                  <p className="font-medium">
                    {formData.lat ? `${formData.lat.toFixed(6)}, ${formData.lng.toFixed(6)}` : '-'}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={getLocation}
                  disabled={isGettingLocation}
                  variant="outline"
                  size="sm"
                >
                  {isGettingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  <span className="ml-2">อัพเดทตำแหน่ง</span>
                </Button>
              </div>
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

        {/* Delivery Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-red-600" />
              ข้อมูลการส่ง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="deliveryType">ประเภท *</Label>
                <Select
                  value={formData.deliveryType}
                  onValueChange={(value: 'pickup' | 'delivery') => 
                    setFormData({ ...formData, deliveryType: value })
                  }
                >
                  <SelectTrigger id="deliveryType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivery">ส่งของ</SelectItem>
                    <SelectItem value="pickup">รับของ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="orderNumber">เลขที่ออเดอร์</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="orderNumber"
                    type="text"
                    value={formData.orderNumber}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                    className="pl-10"
                    placeholder="ORD-12345"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="customerName">ชื่อลูกค้า</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="customerName"
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="pl-10"
                    placeholder="ชื่อผู้รับ/ผู้ส่ง"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="customerPhone">เบอร์โทรศัพท์</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      customerPhone: formatPhoneNumber(e.target.value) 
                    })}
                    className="pl-10"
                    placeholder="0812345678"
                    maxLength={10}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="note">หมายเหตุ</Label>
                <Textarea
                  id="note"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="รายละเอียดเพิ่มเติม..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting || !capturedPhoto || !formData.lat}
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