import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import Tabs from '../../components/ui/Tabs'
import NodeList from './NodeList'
import NamespaceList from './NamespaceList'
import AllDeploymentList from './AllDeploymentList'

export default function ClusterDetailPage() {
  const { context } = useParams<{ context: string }>()
  const [activeTab, setActiveTab] = useState('nodes')

  if (!context) return null

  const tabs = [
    { id: 'nodes', label: '노드' },
    { id: 'namespaces', label: '네임스페이스' },
    { id: 'deployments', label: 'Deployments' },
  ]

  return (
    <div>
      <div className="flex items-center gap-1 text-sm text-text-secondary mb-4">
        <Link to="/k8s" className="hover:text-accent">K8s 클러스터</Link>
        <ChevronRight size={14} />
        <span className="text-text-primary font-medium">{context}</span>
      </div>

      <h1 className="text-lg font-semibold text-text-primary mb-4">{context}</h1>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {activeTab === 'nodes' && <NodeList context={context} />}
        {activeTab === 'namespaces' && <NamespaceList context={context} />}
        {activeTab === 'deployments' && <AllDeploymentList context={context} />}
      </div>
    </div>
  )
}
