import { Routes, Route, Navigate } from 'react-router-dom'
import { PwaAuthProvider, usePwaAuth } from './context/PwaAuthContext'
import { PwaLayout } from './components/layout/PwaLayout'
import PwaLoginPage from './pages/PwaLoginPage'
import DashboardPage from './pages/DashboardPage'
import ClassDetailPage from './pages/ClassDetailPage'
import SchedulePage from './pages/SchedulePage'
import TakeAttendancePage from './pages/TakeAttendancePage'
import SessionHistoryPage from './pages/SessionHistoryPage'
import TeacherProfilePage from './pages/TeacherProfilePage'

function ProtectedTeacherRoute({ children }: { children: React.ReactNode }) {
  const { teacher, loading } = usePwaAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-xs text-muted-foreground">
        Loading teacher session...
      </div>
    )
  }

  if (!teacher) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <PwaAuthProvider>
      <Routes>
        <Route path="/login" element={<PwaLoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedTeacherRoute>
              <PwaLayout />
            </ProtectedTeacherRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="class/:classId" element={<ClassDetailPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="attendance" element={<TakeAttendancePage />} />
          <Route path="history" element={<SessionHistoryPage />} />
          <Route path="profile" element={<TeacherProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PwaAuthProvider>
  )
}
