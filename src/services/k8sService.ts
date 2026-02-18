import { apiClient } from './api'
import type {
  ClusterListResponse,
  NodeInfo,
  NamespaceInfo,
  DeploymentInfo,
  DeploymentLogsResponse,
  ScaleResponse,
} from '../types/k8s'

export const k8sService = {
  getClusters() {
    return apiClient<ClusterListResponse>('GET', '/k8s/clusters')
  },

  getNodes(context: string) {
    return apiClient<NodeInfo[]>('GET', `/k8s/clusters/${context}/nodes`)
  },

  getNamespaces(context: string) {
    return apiClient<NamespaceInfo[]>('GET', `/k8s/clusters/${context}/namespaces`)
  },

  getDeployments(context: string, namespace: string) {
    return apiClient<DeploymentInfo[]>('GET', `/k8s/clusters/${context}/namespaces/${namespace}/deployments`)
  },

  getDeployment(context: string, namespace: string, name: string) {
    return apiClient<DeploymentInfo>('GET', `/k8s/clusters/${context}/namespaces/${namespace}/deployments/${name}`)
  },

  describeDeployment(context: string, namespace: string, name: string) {
    return apiClient<{ describe: string }>('GET', `/k8s/clusters/${context}/namespaces/${namespace}/deployments/${name}/describe`)
  },

  getDeploymentLogs(context: string, namespace: string, name: string, tailLines = 100) {
    return apiClient<DeploymentLogsResponse>('GET', `/k8s/clusters/${context}/namespaces/${namespace}/deployments/${name}/logs`, {
      query: { tailLines: String(tailLines) },
    })
  },

  scaleDeployment(context: string, namespace: string, name: string, replicas: number) {
    return apiClient<ScaleResponse>('PATCH', `/k8s/clusters/${context}/namespaces/${namespace}/deployments/${name}/scale`, {
      body: { replicas },
    })
  },

  restartDeployment(context: string, namespace: string, name: string) {
    return apiClient<{ message: string }>('POST', `/k8s/clusters/${context}/namespaces/${namespace}/deployments/${name}/restart`)
  },
}
