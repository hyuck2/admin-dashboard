import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
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
  const [filterVersion, setFilterVersion] = useState('')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!executing) { setElapsed(0); return }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [executing])

  useEffect(() => {
    appService.getTags(app.appName, app.env).then((data) => {
      setTags(data)
      setLoading(false)
    })
  }, [app.appName, app.env])

  const filteredTags = useMemo(() => {
    if (!filterVersion) return tags
    return tags.filter((t) => t.tag.toLowerCase().includes(filterVersion.toLowerCase()))
  }, [tags, filterVersion])

  const handleRollback = async () => {
    setConfirmOpen(false)
    setExecuting(true)
    try {
      await appService.rollback({
        appName: app.appName,
        env: app.env,
        targetVersion: selectedTag,
      })
      toast('success', `${app.appName} ${app.env}를 ${selectedTag}으로 변경했습니다.`)
      onComplete()
      onClose()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : '버전 변경에 실패했습니다.')
    } finally {
      setExecuting(false)
    }
  }

  return (
    <>
      <Modal open onClose={executing ? () => {} : onClose} title={`배포 버전 선택 - ${app.appName} (${app.env})`}>
        {executing ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Spinner className="h-8 w-8" />
            <p className="text-sm text-text-secondary">
              {app.appName} {app.env}를 {selectedTag}으로 배포 중
              <span className="inline-block w-4 text-left">
                {'.'.repeat((elapsed % 3) + 1)}
              </span>
            </p>
            <p className="text-xs text-text-tertiary">
              경과 시간: {elapsed}초
            </p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <>
            <p className="text-xs text-text-secondary mb-3">
              현재 버전: <span className="font-medium text-text-primary">{app.deployVersion}</span>
            </p>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="버전 검색"
                value={filterVersion}
                onChange={(e) => setFilterVersion(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filteredTags.length === 0 ? (
                <p className="text-xs text-text-tertiary text-center py-4">일치하는 버전이 없습니다.</p>
              ) : (
                filteredTags.map((tag) => (
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
                ))
              )}
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
        open={confirmOpen && !executing}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRollback}
        title="버전 변경 확인"
        message={`${app.appName} ${app.env}를 ${selectedTag}으로 변경합니다. 계속하시겠습니까?`}
        confirmText="변경 실행"
        danger
      />
    </>
  )
}
