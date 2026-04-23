import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AppProvider, useApp } from './store/AppContext'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import CourseDetail from './pages/CourseDetail'
import AssignmentDetail from './pages/AssignmentDetail'

function AppRoutes() {
  const { rootPath, isLoading } = useApp()
  const navigate = useNavigate()

  // Navigate to dashboard once rootPath is set — fires after state is committed,
  // avoiding the race where navigate() runs before rootPath lands in context.
  useEffect(() => {
    if (!isLoading && rootPath) {
      navigate('/dashboard', { replace: true })
    }
  }, [rootPath, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <span className="text-sm text-gray-500">Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route
        path="/dashboard"
        element={rootPath ? <Dashboard /> : <Navigate to="/setup" replace />}
      />
      <Route
        path="/course/:courseId"
        element={rootPath ? <CourseDetail /> : <Navigate to="/setup" replace />}
      />
      <Route
        path="/course/:courseId/assignment/:assignmentId"
        element={rootPath ? <AssignmentDetail /> : <Navigate to="/setup" replace />}
      />
      <Route
        path="*"
        element={<Navigate to={rootPath ? '/dashboard' : '/setup'} replace />}
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <div className="flex h-screen flex-col overflow-hidden">
          <AppRoutes />
        </div>
      </HashRouter>
    </AppProvider>
  )
}
