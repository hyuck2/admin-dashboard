import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { SidebarProvider } from './contexts/SidebarContext'
import ProtectedRoute from './components/common/ProtectedRoute'
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
        <Route path="/" element={<HomePage />} />
        <Route path="/apps" element={<AppsPage />} />
        <Route path="/users" element={<UserManagementPage />} />
        <Route path="/k8s" element={<K8sPage />} />
        <Route path="/k8s/:context" element={<ClusterDetailPage />} />
        <Route path="/k8s/:context/:namespace" element={<NamespaceRedirect />} />
        <Route path="/k8s/:context/:namespace/:name" element={<DeploymentDetailPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
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
