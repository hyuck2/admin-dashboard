import { useEffect, useRef, useState } from 'react'
import type { Server } from '../../types/server'
import Button from '../../components/ui/Button'

interface Props {
  server: Server
  onClose: () => void
}

export default function SshTerminalModal({ server, onClose }: Props) {
  const [connected, setConnected] = useState(false)
  const termRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xtermRef = useRef<any>(null)

  const connect = async () => {
    const token = localStorage.getItem('token') || ''
    const { protocol, host, pathname } = window.location
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:'
    const match = pathname.match(/^(\/[^/]+\/[^/]+)/)
    const basePath = match ? `${match[1]}/api` : '/api'
    const wsUrl = `${wsProto}//${host}${basePath}/ws/ssh?serverId=${server.id}&token=${encodeURIComponent(token)}`

    const { Terminal } = await import('@xterm/xterm')
    const { FitAddon } = await import('@xterm/addon-fit')
    await import('@xterm/xterm/css/xterm.css')

    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, Consolas, monospace',
      theme: { background: '#1e1e2e', foreground: '#cdd6f4', cursor: '#f5e0dc' },
      cursorBlink: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    if (termRef.current) {
      termRef.current.innerHTML = ''
      term.open(termRef.current)
      fitAddon.fit()
    }

    xtermRef.current = term

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onmessage = (ev) => term.write(ev.data)
    ws.onclose = () => {
      setConnected(false)
      term.write('\r\n\x1b[31m연결이 종료되었습니다.\x1b[0m\r\n')
    }
    ws.onerror = () => {
      setConnected(false)
      term.write('\r\n\x1b[31m연결 오류가 발생했습니다.\x1b[0m\r\n')
    }

    term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })
  }

  const disconnect = () => {
    wsRef.current?.close()
    wsRef.current = null
    xtermRef.current?.dispose()
    xtermRef.current = null
    setConnected(false)
  }

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      xtermRef.current?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => { disconnect(); onClose() }} />
      <div className="relative bg-bg-secondary border border-border-primary rounded-lg shadow-xl w-[900px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">
            SSH — {server.hostname} ({server.ipAddress}:{server.sshPort})
          </h3>
          <div className="flex items-center gap-2">
            {connected ? (
              <Button size="sm" variant="danger" onClick={disconnect}>연결 해제</Button>
            ) : (
              <Button size="sm" onClick={connect}>재연결</Button>
            )}
            <button onClick={() => { disconnect(); onClose() }} className="text-text-tertiary hover:text-text-primary text-lg leading-none">&times;</button>
          </div>
        </div>
        <div className="flex-1 p-4">
          <div ref={termRef} className="w-full h-[55vh] rounded-md overflow-hidden bg-[#1e1e2e]" />
        </div>
      </div>
    </div>
  )
}
