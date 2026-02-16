import { type InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export default function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-text-secondary mb-1">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'w-full px-3 py-1.5 text-sm bg-bg-primary text-text-primary border rounded-md',
          'focus:outline-none focus:ring-1 focus:ring-accent',
          error ? 'border-danger' : 'border-border-secondary',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}
