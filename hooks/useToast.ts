// hooks/useToast.ts

import { toast } from 'react-hot-toast'

export const useToast = () => {
  const showToast = (message: string, type: 'success' | 'error' | 'loading' = 'success') => {
    switch (type) {
      case 'success':
        toast.success(message, {
          duration: 3000,
          position: 'top-right',
          style: {
            background: '#10B981',
            color: '#fff',
          },
        })
        break
      case 'error':
        toast.error(message, {
          duration: 4000,
          position: 'top-right',
          style: {
            background: '#EF4444',
            color: '#fff',
          },
        })
        break
      case 'loading':
        toast.loading(message, {
          position: 'top-right',
        })
        break
    }
  }

  const dismissToast = () => {
    toast.dismiss()
  }

  return { showToast, dismissToast }
}