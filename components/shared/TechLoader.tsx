'use client'

export default function TechLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center">
        {/* AMGO Logo Animation */}
        <div className="relative w-16 h-16">
          {/* Background circle */}
          <div className="absolute inset-0 bg-red-100 rounded-2xl animate-pulse"></div>
          
          {/* Logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-red-600 animate-bounce">A</span>
          </div>
          
          {/* Rotating border */}
          <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-red-500 animate-spin"></div>
        </div>
        
        {/* Loading dots */}
        <div className="mt-4 flex space-x-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  )
}