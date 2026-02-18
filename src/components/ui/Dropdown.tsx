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
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false })
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function handleScroll() { setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [])

  const handleOpen = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < 120
      setPos({
        top: openUp ? rect.top : rect.bottom + 4,
        left: rect.right - 160, // w-40 = 10rem = 160px, align right
        openUp,
      })
    }
    setOpen(!open)
  }

  return (
    <div ref={ref}>
      <div onClick={handleOpen} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div
          ref={menuRef}
          className="fixed w-40 bg-bg-primary border border-border-primary rounded-md shadow-lg z-50 py-1"
          style={{
            top: pos.openUp ? undefined : pos.top,
            bottom: pos.openUp ? window.innerHeight - pos.top + 4 : undefined,
            left: Math.max(8, pos.left),
          }}
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
