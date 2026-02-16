import { useState } from 'react'
import { appService } from '../../services/appService'
import type { AppStatus } from '../../types/app'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { toast } from '../../components/ui/Toast'

interface ReplicaModalProps {
  app: AppStatus
  onClose: () => void
  onComplete: () => void
}

export default function ReplicaModal({ app, onClose, onComplete }: ReplicaModalProps) {
  const [replicas, setReplicas] = useState(String(app.replicaDesired))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [executing, setExecuting] = useState(false)

  const replicaNum = Number(replicas)
  const isValid = !isNaN(replicaNum) && replicaNum >= 0 && replicaNum <= 10

  const handleChange = async () => {
    setExecuting(true)
    try {
      await appService.changeReplica({
        appName: app.appName,
        env: app.env,
        replicas: replicaNum,
      })
      toast('success', `${app.appName} ${app.env} Replica를 ${replicaNum}으로 변경했습니다.`)
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
      <Modal open onClose={onClose} title={`Replica 변경 - ${app.appName} (${app.env})`}>
        <p className="text-xs text-text-secondary mb-3">
          현재 Replica: <span className="font-medium text-text-primary">{app.replicaCurrent}/{app.replicaDesired}</span>
        </p>
        <Input
          label="변경할 Replica 수"
          type="number"
          min={0}
          max={10}
          value={replicas}
          onChange={(e) => setReplicas(e.target.value)}
          error={!isValid ? '0~10 사이의 숫자를 입력하세요' : undefined}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!isValid || replicaNum === app.replicaDesired}
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
        message={`${app.appName} ${app.env}의 Replica를 ${app.replicaDesired} → ${replicaNum}으로 변경합니다. 계속하시겠습니까?`}
        confirmText="변경 실행"
        danger
        loading={executing}
      />
    </>
  )
}
