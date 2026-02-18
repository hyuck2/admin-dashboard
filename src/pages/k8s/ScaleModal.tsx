import { useState } from 'react'
import { k8sService } from '../../services/k8sService'
import type { DeploymentInfo } from '../../types/k8s'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'

interface Props {
  context: string
  namespace: string
  deployment: DeploymentInfo
  onClose: () => void
  onComplete: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

export default function ScaleModal({ context, namespace, deployment, onClose, onComplete, onToast }: Props) {
  const [replicas, setReplicas] = useState(deployment.replicas)
  const [loading, setLoading] = useState(false)

  const handleScale = async () => {
    setLoading(true)
    try {
      await k8sService.scaleDeployment(context, namespace, deployment.name, replicas)
      onToast(`${deployment.name} → ${replicas} replica로 변경 완료`, 'success')
      onComplete()
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Scale 실패', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Scale — ${deployment.name}`}>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-text-secondary mb-1">
            현재: {deployment.readyReplicas}/{deployment.replicas} replica
          </p>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">Replicas</label>
          <input
            type="range"
            min={0}
            max={20}
            value={replicas}
            onChange={(e) => setReplicas(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min={0}
              max={100}
              value={replicas}
              onChange={(e) => setReplicas(Math.max(0, Number(e.target.value)))}
              className="w-20 px-2 py-1 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md text-center"
            />
            <span className="text-xs text-text-tertiary">개</span>
          </div>
          {replicas === 0 && (
            <p className="text-xs text-warning mt-1">Replicas가 0이면 Pod가 모두 종료됩니다.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>취소</Button>
          <Button
            variant={replicas === 0 ? 'danger' : 'primary'}
            onClick={handleScale}
            disabled={loading || replicas === deployment.replicas}
          >
            {loading ? '처리 중...' : '변경'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
