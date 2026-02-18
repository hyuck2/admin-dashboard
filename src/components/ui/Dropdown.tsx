import { useState, useRef, useEffect, type ReactNode } from 'react'

interface DropdownItem {
  label: string
  onClick: () => void
  danger?: boolean
}

interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
}

export default function Dropdown({ trigger, items }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpen = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUp(spaceBelow < 120)
    }
    setOpen(!open)
  }

  return (
    <div className="relative" ref={ref}>
      <div onClick={handleOpen} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div
          className={`absolute right-0 w-40 bg-bg-primary border border-border-primary rounded-md shadow-lg z-40 py-1 ${
            openUp ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { item.onClick(); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-bg-hover ${item.danger ? 'text-danger' : 'text-text-primary'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
