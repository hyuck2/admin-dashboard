import { type ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent hover:bg-accent-hover text-text-inverse',
  secondary: 'bg-bg-tertiary hover:bg-bg-active text-text-primary border border-border-secondary',
  danger: 'bg-danger hover:bg-danger-hover text-white',
  ghost: 'hover:bg-bg-hover text-text-secondary',
}

const sizes = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

export default function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
