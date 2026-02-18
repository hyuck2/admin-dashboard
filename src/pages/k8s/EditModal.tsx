import { useEffect, useState } from 'react'
import { k8sService } from '../../services/k8sService'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

interface Props {
  context: string
  namespace: string
  deploymentName: string
  onClose: () => void
  onComplete: () => void
  onToast: (message: string, type: 'success' | 'error') => void
}

export default function EditModal({ context, namespace, deploymentName, onClose, onComplete, onToast }: Props) {
  const [yaml, setYaml] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    k8sService.getDeploymentYaml(context, namespace, deploymentName)
      .then((res) => setYaml(res.yaml))
      .catch((e) => onToast(e instanceof Error ? e.message : 'YAML 조회 실패', 'error'))
      .finally(() => setLoading(false))
  }, [context, namespace, deploymentName])

  const handleApply = async () => {
    setSaving(true)
    try {
      await k8sService.updateDeploymentYaml(context, namespace, deploymentName, yaml)
      onToast(`${deploymentName} 업데이트 완료`, 'success')
      onComplete()
    } catch (e) {
      onToast(e instanceof Error ? e.message : '업데이트 실패', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border-primary rounded-lg shadow-xl w-[800px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Edit — {deploymentName}</h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="h-5 w-5" />
            </div>
          ) : (
            <textarea
              value={yaml}
              onChange={(e) => setYaml(e.target.value)}
              spellCheck={false}
              className="w-full h-[60vh] bg-[#1e1e2e] text-[#cdd6f4] text-xs font-mono p-4 rounded-md border border-border-secondary resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-primary">
          <Button variant="ghost" size="sm" onClick={onClose}>취소</Button>
          <Button size="sm" onClick={handleApply} disabled={loading || saving}>
            {saving ? '적용 중...' : '적용'}
          </Button>
        </div>
      </div>
    </div>
  )
}
