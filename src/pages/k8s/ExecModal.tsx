import { useEffect, useRef, useState } from 'react'
import { k8sService } from '../../services/k8sService'
import type { PodInfo } from '../../types/k8s'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

interface Props {
  context: string
  namespace: string
  deploymentName: string
  onClose: () => void
}

export default function ExecModal({ context, namespace, deploymentName, onClose }: Props) {
  const [pods, setPods] = useState<PodInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPod, setSelectedPod] = useState('')
  const [selectedContainer, setSelectedContainer] = useState('')
  const [connected, setConnected] = useState(false)

  const termRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xtermRef = useRef<any>(null)

  useEffect(() => {
    k8sService.getDeploymentPods(context, namespace, deploymentName)
      .then((res) => {
        setPods(res)
        if (res.length > 0) {
          setSelectedPod(res[0].name)
          if (res[0].containers.length > 0) {
            setSelectedContainer(res[0].containers[0].name)
          }
        }
      })
      .finally(() => setLoading(false))
  }, [context, namespace, deploymentName])

  // Update container selection when pod changes
  useEffect(() => {
    const pod = pods.find((p) => p.name === selectedPod)
    if (pod && pod.containers.length > 0) {
      setSelectedContainer(pod.containers[0].name)
    }
  }, [selectedPod, pods])

  const connect = async () => {
    if (!selectedPod || !selectedContainer) return

    const token = localStorage.getItem('token') || ''

    // Determine WebSocket base URL
    const { protocol, host, pathname } = window.location
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:'
    const match = pathname.match(/^(\/[^/]+\/[^/]+)/)
    const basePath = match ? `${match[1]}/api` : '/api'
    const wsUrl = `${wsProto}//${host}${basePath}/k8s/ws/exec?context=${encodeURIComponent(context)}&namespace=${encodeURIComponent(namespace)}&pod=${encodeURIComponent(selectedPod)}&container=${encodeURIComponent(selectedContainer)}&token=${encodeURIComponent(token)}`

    // Dynamically import xterm
    const { Terminal } = await import('@xterm/xterm')
    const { FitAddon } = await import('@xterm/addon-fit')
    await import('@xterm/xterm/css/xterm.css')

    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
      },
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

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (ev) => {
      term.write(ev.data)
    }

    ws.onclose = () => {
      setConnected(false)
      term.write('\r\n\x1b[31m연결이 종료되었습니다.\x1b[0m\r\n')
    }

    ws.onerror = () => {
      setConnected(false)
      term.write('\r\n\x1b[31m연결 오류가 발생했습니다.\x1b[0m\r\n')
    }

    term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })
  }

  const disconnect = () => {
    wsRef.current?.close()
    wsRef.current = null
    xtermRef.current?.dispose()
    xtermRef.current = null
    setConnected(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close()
      xtermRef.current?.dispose()
    }
  }, [])

  const currentPod = pods.find((p) => p.name === selectedPod)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => { disconnect(); onClose() }} />
      <div className="relative bg-bg-secondary border border-border-primary rounded-lg shadow-xl w-[900px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Exec — {deploymentName}</h3>
          <button onClick={() => { disconnect(); onClose() }} className="text-text-tertiary hover:text-text-primary text-lg leading-none">&times;</button>
        </div>

        <div className="px-5 py-3 border-b border-border-primary flex items-center gap-3">
          {loading ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <>
              <label className="text-xs text-text-secondary">Pod:</label>
              <select
                value={selectedPod}
                onChange={(e) => setSelectedPod(e.target.value)}
                disabled={connected}
                className="text-xs bg-bg-primary text-text-primary border border-border-secondary rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {pods.map((p) => (
                  <option key={p.name} value={p.name}>{p.name} ({p.status})</option>
                ))}
              </select>

              <label className="text-xs text-text-secondary">Container:</label>
              <select
                value={selectedContainer}
                onChange={(e) => setSelectedContainer(e.target.value)}
                disabled={connected}
                className="text-xs bg-bg-primary text-text-primary border border-border-secondary rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {currentPod?.containers.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>

              {!connected ? (
                <Button size="sm" onClick={connect} disabled={!selectedPod || !selectedContainer}>
                  연결
                </Button>
              ) : (
                <Button size="sm" variant="danger" onClick={disconnect}>
                  연결 해제
                </Button>
              )}
            </>
          )}
        </div>

        <div className="flex-1 p-4">
          <div
            ref={termRef}
            className="w-full h-[55vh] rounded-md overflow-hidden bg-[#1e1e2e]"
          />
        </div>
      </div>
    </div>
  )
}
