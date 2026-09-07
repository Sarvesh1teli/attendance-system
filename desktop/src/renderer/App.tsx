import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { MainLayout } from './layouts/MainLayout'
import { SetupLayout } from './layouts/SetupLayout'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { AuthProvider, useAuth } from './context/AuthContext'

const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const InstitutionSetupPage = lazy(() => import('./pages/setup/InstitutionSetupPage'))
const CourseProgramPage = lazy(() => import('./pages/academic/CourseProgramPage'))
const DepartmentPage = lazy(() => import('./pages/academic/DepartmentPage'))
const BatchPage = lazy(() => import('./pages/academic/BatchPage'))
const AcademicYearPage = lazy(() => import('./pages/academic/AcademicYearPage'))
const SubjectPage = lazy(() => import('./pages/academic/SubjectPage'))
const FacultyPage = lazy(() => import('./pages/people/FacultyPage'))
const StudentPage = lazy(() => import('./pages/people/StudentPage'))
const StudentGroupPage = lazy(() => import('./pages/academic/StudentGroupPage'))
const TopicPage = lazy(() => import('./pages/academic/TopicPage'))
const StudentFaceEnrollmentPage = lazy(() => import('./pages/face/StudentFaceEnrollmentPage'))
const FacultyFaceEnrollmentPage = lazy(() => import('./pages/face/FacultyFaceEnrollmentPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AuditPage = lazy(() => import('./pages/admin/AuditPage'))
const AttendanceDashboardPage = lazy(() => import('./pages/attendance/AttendanceDashboardPage'))
const LiveAttendanceSessionPage = lazy(() => import('./pages/attendance/LiveAttendanceSessionPage'))
const FacultyDailyAttendancePage = lazy(() => import('./pages/attendance/FacultyDailyAttendancePage'))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'))
const RecognitionSessionPage = lazy(() => import('./pages/attendance/RecognitionSessionPage'))
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'))
const TimetablePage = lazy(() => import('./pages/timetable/TimetablePage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, hasInstitution, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (hasInstitution === false) {
    return <Navigate to="/setup" replace />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Initial Setup Route */}
          <Route path="/setup" element={<SetupLayout />}>
            <Route index element={<InstitutionSetupPage />} />
          </Route>

          {/* Protected Main Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Academic */}
            <Route path="academic">
              <Route path="programs" element={<CourseProgramPage />} />
              <Route path="departments" element={<DepartmentPage />} />
              <Route path="batches" element={<BatchPage />} />
              <Route path="years" element={<AcademicYearPage />} />
              <Route path="subjects" element={<SubjectPage />} />
              <Route path="groups" element={<StudentGroupPage />} />
              <Route path="topics" element={<TopicPage />} />
            </Route>

            {/* People */}
            <Route path="people">
              <Route path="faculty" element={<FacultyPage />} />
              <Route path="students" element={<StudentPage />} />
            </Route>

            {/* Face Enrollment */}
            <Route path="face">
              <Route path="students" element={<StudentFaceEnrollmentPage />} />
              <Route path="faculty" element={<FacultyFaceEnrollmentPage />} />
            </Route>

            {/* Attendance & Faculty Tracking */}
            <Route path="attendance">
              <Route index element={<AttendanceDashboardPage />} />
              <Route path="session/:id" element={<LiveAttendanceSessionPage />} />
              <Route path="session/:id/recognize" element={<RecognitionSessionPage />} />
              <Route path="faculty" element={<FacultyDailyAttendancePage />} />
            </Route>

            {/* Reports & Analytics */}
            <Route path="reports" element={<ReportsPage />} />

            {/* Notifications */}
            <Route path="notifications" element={<NotificationsPage />} />

            {/* Timetable */}
            <Route path="timetable" element={<TimetablePage />} />

            {/* Admin */}
            <Route path="admin">
              <Route path="audit" element={<AuditPage />} />
            </Route>

            {/* Settings */}
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
