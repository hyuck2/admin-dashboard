import { useRef, useEffect } from 'react'

interface Props {
  title: string
  data: [number, string][]  // [timestamp, value]
  color: string
}

export default function MetricsChart({ title, data, color }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const padding = { top: 10, right: 10, bottom: 25, left: 40 }
    const chartW = w - padding.left - padding.right
    const chartH = h - padding.top - padding.bottom

    const values = data.map((d) => parseFloat(d[1]))
    const timestamps = data.map((d) => d[0])
    const maxVal = Math.max(...values, 1)
    const minVal = Math.min(...values, 0)
    const range = maxVal - minVal || 1

    // Background
    const style = getComputedStyle(document.documentElement)
    const bgColor = style.getPropertyValue('--color-bg-primary').trim() || '#1e1e2e'
    const textColor = style.getPropertyValue('--color-text-tertiary').trim() || '#888'
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, w, h)

    // Grid lines
    ctx.strokeStyle = textColor + '33'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(w - padding.right, y)
      ctx.stroke()

      // Y labels
      ctx.fillStyle = textColor
      ctx.font = '10px monospace'
      ctx.textAlign = 'right'
      const val = maxVal - (range / 4) * i
      ctx.fillText(val.toFixed(1), padding.left - 4, y + 3)
    }

    // X labels
    const labelCount = Math.min(5, timestamps.length)
    ctx.textAlign = 'center'
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.floor((timestamps.length - 1) * i / (labelCount - 1))
      const x = padding.left + (chartW * idx) / (data.length - 1)
      const date = new Date(timestamps[idx] * 1000)
      ctx.fillText(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), x, h - 5)
    }

    // Line
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'

    for (let i = 0; i < data.length; i++) {
      const x = padding.left + (chartW * i) / (data.length - 1)
      const y = padding.top + chartH - ((values[i] - minVal) / range) * chartH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Fill area
    const lastX = padding.left + chartW
    ctx.lineTo(lastX, padding.top + chartH)
    ctx.lineTo(padding.left, padding.top + chartH)
    ctx.closePath()
    ctx.fillStyle = color + '20'
    ctx.fill()
  }, [data, color])

  return (
    <div className="border border-border-primary rounded-lg p-3 bg-bg-primary">
      <h3 className="text-xs font-medium text-text-secondary mb-2">{title}</h3>
      {data.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-xs text-text-tertiary">데이터 없음</div>
      ) : (
        <canvas ref={canvasRef} className="w-full h-32" />
      )}
    </div>
  )
}
