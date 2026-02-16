import { type SelectHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export default function Select({ label, options, className, id, ...props }: SelectProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-text-secondary mb-1">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          'w-full px-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md',
          'focus:outline-none focus:ring-1 focus:ring-accent',
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
