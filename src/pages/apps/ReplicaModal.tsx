import { useState } from 'react'
import { appService } from '../../services/appService'
import type { AppStatus, ComponentInfo } from '../../types/app'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { toast } from '../../components/ui/Toast'

interface ReplicaModalProps {
  open: boolean
  app: AppStatus
  component: ComponentInfo
  onClose: () => void
  onComplete: () => void
}

export default function ReplicaModal({ open, app, component, onClose, onComplete }: ReplicaModalProps) {
  const [replicas, setReplicas] = useState(String(component.replicaDesired))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [executing, setExecuting] = useState(false)

  const replicaNum = Number(replicas)
  const isValid = !isNaN(replicaNum) && replicaNum >= 0 && replicaNum <= 20

  const handleChange = async () => {
    setExecuting(true)
    try {
      await appService.changeReplica({
        appName: app.appName,
        env: app.env,
        componentName: component.name,
        replicas: replicaNum,
      })
      toast('success', `${component.name} Replica를 ${replicaNum}으로 변경했습니다.`)
      onComplete()
      onClose()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Replica 변경에 실패했습니다.')
    } finally {
      setExecuting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Replica 변경 - ${component.name}`}>
        <p className="text-xs text-text-secondary mb-1">
          앱: <span className="font-medium text-text-primary">{app.appName} ({app.env})</span>
        </p>
        <p className="text-xs text-text-secondary mb-3">
          현재 Replica: <span className="font-medium text-text-primary">{component.replicaCurrent}/{component.replicaDesired}</span>
        </p>
        <Input
          label="변경할 Replica 수"
          type="number"
          min={0}
          max={20}
          value={replicas}
          onChange={(e) => setReplicas(e.target.value)}
          error={!isValid ? '0~20 사이의 숫자를 입력하세요' : undefined}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!isValid || replicaNum === component.replicaDesired}
          >
            변경하기
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleChange}
        title="Replica 변경 확인"
        message={`${component.name}의 Replica를 ${component.replicaDesired} → ${replicaNum}으로 변경합니다. 계속하시겠습니까?`}
        confirmText="변경 실행"
        danger
        loading={executing}
      />
    </>
  )
}
