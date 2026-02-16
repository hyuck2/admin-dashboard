import { useState } from 'react'
import Tabs from '../../components/ui/Tabs'
import UsersTab from './UsersTab'
import GroupsTab from './GroupsTab'

const tabs = [
  { id: 'users', label: '사용자' },
  { id: 'groups', label: '그룹' },
]

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div>
      <h1 className="text-lg font-semibold text-text-primary mb-4">사용자 & 권한 관리</h1>
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      <div className="mt-4">
        {activeTab === 'users' ? <UsersTab /> : <GroupsTab />}
      </div>
    </div>
  )
}
