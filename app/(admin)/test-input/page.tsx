'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Search } from 'lucide-react';
import { colors, gradients, semanticColors } from '@/lib/theme/colors';

export default function TestInputPage() {
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('999 ถ.พระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ 10330');
  const [radius, setRadius] = useState('100');

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">Design System</h1>

      {/* Color Scheme */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Color Scheme</h2>
        
        {/* Primary Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Primary Colors (Blue)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
              {Object.entries(colors.primary).map(([shade, color]) => (
                <div key={shade} className="text-center">
                  <div 
                    className="w-full h-16 rounded-lg shadow-sm mb-2" 
                    style={{ backgroundColor: color }}
                  />
                  <p className="text-xs font-medium">{shade}</p>
                  <p className="text-xs text-gray-500">{color}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gray Scale */}
        <Card>
          <CardHeader>
            <CardTitle>Gray Scale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
              {Object.entries(colors.gray).map(([shade, color]) => (
                <div key={shade} className="text-center">
                  <div 
                    className="w-full h-16 rounded-lg shadow-sm mb-2 border" 
                    style={{ backgroundColor: color }}
                  />
                  <p className="text-xs font-medium">{shade}</p>
                  <p className="text-xs text-gray-500">{color}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Semantic Colors */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Success */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Success (Green)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[50, 100, 500, 600, 700].map(shade => (
                <div key={shade} className="flex items-center gap-2">
                  <div 
                    className="w-12 h-8 rounded" 
                    style={{ backgroundColor: colors.success[shade] }}
                  />
                  <span className="text-sm">{shade}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Warning */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Warning (Amber)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[50, 100, 500, 600, 700].map(shade => (
                <div key={shade} className="flex items-center gap-2">
                  <div 
                    className="w-12 h-8 rounded" 
                    style={{ backgroundColor: colors.warning[shade] }}
                  />
                  <span className="text-sm">{shade}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Error */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Error (Red)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[50, 100, 500, 600, 700].map(shade => (
                <div key={shade} className="flex items-center gap-2">
                  <div 
                    className="w-12 h-8 rounded" 
                    style={{ backgroundColor: colors.error[shade] }}
                  />
                  <span className="text-sm">{shade}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Info (Blue)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[50, 100, 500, 600, 700].map(shade => (
                <div key={shade} className="flex items-center gap-2">
                  <div 
                    className="w-12 h-8 rounded" 
                    style={{ backgroundColor: colors.info[shade] }}
                  />
                  <span className="text-sm">{shade}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Gradients */}
        <Card>
          <CardHeader>
            <CardTitle>Gradients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(gradients).map(([name, gradient]) => (
                <div key={name}>
                  <div className={`h-20 rounded-lg bg-gradient-to-r ${gradient} mb-2`} />
                  <p className="text-sm font-medium capitalize">{name.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-xs text-gray-500">{gradient}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Input Components */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Input Components</h2>

        {/* Example from the image */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              ตัวอย่างจากรูป
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-medium">
                ชื่อสถานที่ *
              </Label>
              <Input
                id="location"
                placeholder="เช่น สาขาสยาม"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-base font-medium">
                ที่อยู่ *
              </Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="radius" className="text-base font-medium">
                รัศมี Geofencing (เมตร)
              </Label>
              <Input
                id="radius"
                type="number"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Input States with Theme Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Input States</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Default</Label>
                <Input placeholder="Placeholder text" />
              </div>

              <div className="space-y-2">
                <Label>With Value</Label>
                <Input value="Input with value" readOnly />
              </div>

              <div className="space-y-2">
                <Label>Success State</Label>
                <Input 
                  placeholder="Success input" 
                  className="border-green-500 focus:ring-green-200" 
                />
                <p className="text-sm text-green-600">✓ Valid input</p>
              </div>

              <div className="space-y-2">
                <Label>Error State</Label>
                <Input 
                  placeholder="Error input" 
                  className="border-red-500 focus:ring-red-200" 
                />
                <p className="text-sm text-red-600">This field is required</p>
              </div>

              <div className="space-y-2">
                <Label>Warning State</Label>
                <Input 
                  placeholder="Warning input" 
                  className="border-amber-500 focus:ring-amber-200" 
                />
                <p className="text-sm text-amber-600">Please check this field</p>
              </div>

              <div className="space-y-2">
                <Label>Disabled</Label>
                <Input placeholder="Disabled input" disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Button Examples with Theme */}
        <Card>
          <CardHeader>
            <CardTitle>Buttons with Theme Colors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button className="bg-blue-600 hover:bg-blue-700">Primary</Button>
              <Button className="bg-green-600 hover:bg-green-700">Success</Button>
              <Button className="bg-amber-600 hover:bg-amber-700">Warning</Button>
              <Button className="bg-red-600 hover:bg-red-700">Error</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button disabled>Disabled</Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Examples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">Info Message</h3>
              <p className="text-blue-700">This is an informational message using theme colors.</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-medium text-green-900 mb-2">Success Message</h3>
              <p className="text-green-700">Operation completed successfully!</p>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h3 className="font-medium text-amber-900 mb-2">Warning Message</h3>
              <p className="text-amber-700">Please review before proceeding.</p>
            </div>

            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <h3 className="font-medium text-red-900 mb-2">Error Message</h3>
              <p className="text-red-700">Something went wrong. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}