import { useEffect, useState, useCallback } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '../../utils/cn'

interface ToastData {
  id: number
  type: 'success' | 'error'
  message: string
}

let toastId = 0
let addToastFn: ((toast: Omit<ToastData, 'id'>) => void) | null = null

export function toast(type: 'success' | 'error', message: string) {
  addToastFn?.({ type, message })
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const addToast = useCallback((data: Omit<ToastData, 'id'>) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { ...data, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm border',
            t.type === 'success'
              ? 'bg-success-light text-success border-success/20'
              : 'bg-danger-light text-danger border-danger/20',
          )}
        >
          {t.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{t.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="ml-2 opacity-60 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
