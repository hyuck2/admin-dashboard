import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { SidebarProvider } from './contexts/SidebarContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import PageProtectedRoute from './components/common/PageProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/login/LoginPage'
import ChangePasswordPage from './pages/login/ChangePasswordPage'
import HomePage from './pages/home/HomePage'
import AppsPage from './pages/apps/AppsPage'
import UserManagementPage from './pages/users/UserManagementPage'
import AuditLogPage from './pages/audit/AuditLogPage'
import K8sPage from './pages/k8s/K8sPage'
import ClusterDetailPage from './pages/k8s/ClusterDetailPage'
import DeploymentDetailPage from './pages/k8s/DeploymentDetailPage'
import ServerManagementPage from './pages/servers/ServerManagementPage'
import MetricSourceDetailPage from './pages/servers/MetricSourceDetailPage'
import AnsibleExecutionDetailPage from './pages/servers/AnsibleExecutionDetailPage'
import ToastContainer from './components/ui/Toast'

function NamespaceRedirect() {
  const { context, namespace } = useParams()
  return <Navigate to={`/k8s/${context}?tab=deployments&ns=${namespace}`} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route
        element={
          <ProtectedRoute>
            <SidebarProvider>
              <AppLayout />
            </SidebarProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<PageProtectedRoute pageId="home"><HomePage /></PageProtectedRoute>} />
        <Route path="/apps" element={<PageProtectedRoute pageId="apps"><AppsPage /></PageProtectedRoute>} />
        <Route path="/users" element={<PageProtectedRoute pageId="users"><UserManagementPage /></PageProtectedRoute>} />
        <Route path="/k8s" element={<PageProtectedRoute pageId="k8s"><K8sPage /></PageProtectedRoute>} />
        <Route path="/k8s/:context" element={<PageProtectedRoute pageId="k8s"><ClusterDetailPage /></PageProtectedRoute>} />
        <Route path="/k8s/:context/:namespace" element={<PageProtectedRoute pageId="k8s"><NamespaceRedirect /></PageProtectedRoute>} />
        <Route path="/k8s/:context/:namespace/:name" element={<PageProtectedRoute pageId="k8s"><DeploymentDetailPage /></PageProtectedRoute>} />
        <Route path="/servers" element={<PageProtectedRoute pageId="servers"><ServerManagementPage /></PageProtectedRoute>} />
        <Route path="/servers/prometheus/:id" element={<PageProtectedRoute pageId="servers"><MetricSourceDetailPage /></PageProtectedRoute>} />
        <Route path="/servers/ansible/executions/:id" element={<PageProtectedRoute pageId="servers"><AnsibleExecutionDetailPage /></PageProtectedRoute>} />
        <Route path="/audit" element={<PageProtectedRoute pageId="audit"><AuditLogPage /></PageProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// Detect sub-path basename (e.g. /prod/admin-dashboard-frontend)
// Works for both dev (/) and K8s deployment (/env/appname/)
function getBasename(): string {
  const { pathname } = window.location
  const match = pathname.match(/^(\/[^/]+\/[^/]+)/)
  return match ? match[1] : '/'
}

export default function App() {
  return (
    <BrowserRouter basename={getBasename()}>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
