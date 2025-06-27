import TechLoader from '@/components/shared/TechLoader'

interface LoadingWrapperProps {
  loading: boolean
  children: React.ReactNode
  fullScreen?: boolean
}

export default function LoadingWrapper({ 
  loading, 
  children, 
  fullScreen = true 
}: LoadingWrapperProps) {
  if (loading) {
    return fullScreen ? (
      <TechLoader />
    ) : (
      <div className="relative min-h-[200px] flex items-center justify-center">
        <TechLoader />
      </div>
    )
  }

  return <>{children}</>
}