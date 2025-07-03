'use client'

export default function TechLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-blue-100 to-white backdrop-blur-sm">
      <style jsx>{`
        @keyframes fly {
          0%, 100% { transform: translateY(20px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes flame {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.2); }
        }
        
        @keyframes smoke {
          0% { 
            transform: translateY(0) scale(0.5); 
            opacity: 0.8;
          }
          100% { 
            transform: translateY(40px) scale(2); 
            opacity: 0;
          }
        }
      `}</style>
      
      <div className="relative animate-[fly_2s_ease-in-out_infinite]">
        {/* Rocket */}
        <div className="relative">
          {/* Body */}
          <div className="w-8 h-12 bg-red-500 rounded-t-full"></div>
          
          {/* Window */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-300 rounded-full"></div>
          
          {/* Fins */}
          <div className="absolute bottom-0 -left-2 w-0 h-0 border-l-[6px] border-l-transparent border-b-[8px] border-b-red-600 border-r-[6px] border-r-transparent"></div>
          <div className="absolute bottom-0 -right-2 w-0 h-0 border-l-[6px] border-l-transparent border-b-[8px] border-b-red-600 border-r-[6px] border-r-transparent"></div>
          
          {/* Flame */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-orange-400 rounded-full animate-[flame_0.3s_ease-in-out_infinite]"></div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3 h-3 bg-yellow-400 rounded-full animate-[flame_0.3s_ease-in-out_infinite_0.1s]"></div>
          
          {/* Smoke clouds */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className="absolute w-6 h-6 bg-gray-300 rounded-full animate-[smoke_1s_ease-out_infinite]"></div>
            <div className="absolute w-5 h-5 bg-gray-400 rounded-full animate-[smoke_1s_ease-out_infinite_0.2s] -left-3"></div>
            <div className="absolute w-5 h-5 bg-gray-400 rounded-full animate-[smoke_1s_ease-out_infinite_0.4s] -right-3"></div>
            <div className="absolute w-7 h-7 bg-gray-300/70 rounded-full animate-[smoke_1s_ease-out_infinite_0.6s] left-2"></div>
          </div>
        </div>
      </div>
    </div>
  )
}