import { useSearchParams } from 'react-router-dom'
import Tabs from '../../components/ui/Tabs'
import ServersTab from './ServersTab'
import ServerGroupsTab from './ServerGroupsTab'
import MetricSourcesTab from './MetricSourcesTab'
import AnsibleTab from './AnsibleTab'

const tabs = [
  { id: 'servers', label: '서버 목록' },
  { id: 'groups', label: '서버 그룹' },
  { id: 'metrics', label: 'Prometheus' },
  { id: 'ansible', label: 'Ansible' },
]

export default function ServerManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'servers'

  const handleTabChange = (tab: string) => {
    if (tab === 'servers') {
      setSearchParams({})
    } else {
      setSearchParams({ tab })
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-text-primary mb-4">서버 관리</h1>
      <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
      <div className="mt-4">
        {activeTab === 'servers' && <ServersTab />}
        {activeTab === 'groups' && <ServerGroupsTab />}
        {activeTab === 'metrics' && <MetricSourcesTab />}
        {activeTab === 'ansible' && <AnsibleTab />}
      </div>
    </div>
  )
}
