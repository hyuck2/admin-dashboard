import { useEffect, useState } from 'react'
import { appService } from '../../services/appService'
import type { AppStatus, AppTag } from '../../types/app'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../utils/cn'

interface RollbackModalProps {
  app: AppStatus
  onClose: () => void
  onComplete: () => void
}

export default function RollbackModal({ app, onClose, onComplete }: RollbackModalProps) {
  const [tags, setTags] = useState<AppTag[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    appService.getTags(app.appName).then((data) => {
      setTags(data)
      setLoading(false)
    })
  }, [app.appName])

  const handleRollback = async () => {
    setExecuting(true)
    try {
      await appService.rollback({
        appName: app.appName,
        env: app.env,
        targetVersion: selectedTag,
      })
      toast('success', `${app.appName} ${app.env}를 ${selectedTag}으로 롤백했습니다.`)
      onComplete()
      onClose()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : '롤백에 실패했습니다.')
    } finally {
      setExecuting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title={`Rollback - ${app.appName} (${app.env})`}>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <>
            <p className="text-xs text-text-secondary mb-3">
              현재 버전: <span className="font-medium text-text-primary">{app.deployVersion}</span>
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {tags.map((tag) => (
                <button
                  key={tag.tag}
                  onClick={() => setSelectedTag(tag.tag)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between',
                    selectedTag === tag.tag
                      ? 'bg-accent-light text-accent border border-accent/30'
                      : 'hover:bg-bg-hover text-text-primary',
                    tag.tag === app.deployVersion && 'opacity-50',
                  )}
                  disabled={tag.tag === app.deployVersion}
                >
                  <span>{tag.tag}</span>
                  {tag.tag === app.deployVersion && (
                    <span className="text-xs text-text-tertiary">현재</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={onClose}>취소</Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!selectedTag}
              >
                변경하기
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRollback}
        title="롤백 확인"
        message={`${app.appName} ${app.env}를 ${selectedTag}으로 롤백합니다. 계속하시겠습니까?`}
        confirmText="롤백 실행"
        danger
        loading={executing}
      />
    </>
  )
}
