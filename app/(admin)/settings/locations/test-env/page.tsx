// app/(admin)/settings/locations/test-env/page.tsx
'use client'

export default function TestEnvPage() {
  // Log all environment variables that start with NEXT_PUBLIC_
  const envVars = Object.keys(process.env)
    .filter(key => key.startsWith('NEXT_PUBLIC_'))
    .map(key => ({
      key,
      value: process.env[key] ? '***' + process.env[key]?.slice(-4) : 'undefined'
    }))

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Test</h1>
      
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-semibold mb-2">Google Maps API Key Status:</h2>
        <p className="font-mono">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: {
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 
              ? `***${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.slice(-4)}` 
              : 'NOT FOUND'
          }
        </p>
      </div>

      <div className="mt-4 bg-gray-100 p-4 rounded">
        <h2 className="font-semibold mb-2">All NEXT_PUBLIC_ variables:</h2>
        <pre className="font-mono text-sm">
          {JSON.stringify(envVars, null, 2)}
        </pre>
      </div>

      <div className="mt-4">
        <p className="text-sm text-gray-600">
          Node Environment: {process.env.NODE_ENV}
        </p>
      </div>
    </div>
  )
}