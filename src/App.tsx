import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import ToastContainer from './components/ui/Toast'

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
        <Route path="/audit" element={<AuditLogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
