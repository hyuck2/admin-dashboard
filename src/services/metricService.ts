import { apiClient } from './api'
import type { MetricSource, MetricTarget, ServerMetrics } from '../types/server'

export const metricService = {
  getSources() {
    return apiClient<MetricSource[]>('GET', '/metrics/sources')
  },
  createSource(data: { name: string; url: string; description?: string; isActive?: boolean }) {
    return apiClient<MetricSource>('POST', '/metrics/sources', { body: data })
  },
  updateSource(id: number, data: { name?: string; url?: string; description?: string; isActive?: boolean }) {
    return apiClient<MetricSource>('PUT', `/metrics/sources/${id}`, { body: data })
  },
  deleteSource(id: number) {
    return apiClient<{ message: string }>('DELETE', `/metrics/sources/${id}`)
  },
  testSource(id: number) {
    return apiClient<{ message: string }>('POST', `/metrics/sources/${id}/test`)
  },
  getTargets(id: number) {
    return apiClient<MetricTarget[]>('GET', `/metrics/sources/${id}/targets`)
  },
  getMetrics(id: number, ip: string, range: string = '1h') {
    return apiClient<ServerMetrics>('GET', `/metrics/sources/${id}/metrics`, {
      query: { ip, range },
    })
  },
}
