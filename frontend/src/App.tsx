import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import NavBar from './components/NavBar'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/prospect/LandingPage'
import PillarSelectPage from './pages/prospect/PillarSelectPage'
import AssessmentPage from './pages/prospect/AssessmentPage'
import ReportPage from './pages/prospect/ReportPage'
import AccountsListPage from './pages/internal/AccountsListPage'
import AccountDetailPage from './pages/internal/AccountDetailPage'
import ReportDetailPage from './pages/internal/ReportDetailPage'
import UsersPage from './pages/admin/UsersPage'
import PillarsPage from './pages/admin/PillarsPage'
import QuestionsPage from './pages/admin/QuestionsPage'
import SettingsPage from './pages/admin/SettingsPage'

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <NavBar />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            {/* Prospect flow — no nav bar */}
            <Route path="/assess/:token" element={<LandingPage />} />
            <Route path="/assess/:token/pillars" element={<PillarSelectPage />} />
            <Route path="/assess/:token/assessment/:assessmentId" element={<AssessmentPage />} />
            <Route path="/assess/:token/report/:assessmentId" element={<ReportPage />} />
            {/* Authenticated pages — nav bar shown */}
            <Route element={<AuthenticatedLayout />}>
              <Route path="/dashboard" element={<AccountsListPage />} />
              <Route path="/dashboard/accounts/:id" element={<AccountDetailPage />} />
              <Route path="/dashboard/assessments/:id" element={<ReportDetailPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/pillars" element={<PillarsPage />} />
              <Route path="/admin/pillars/:id/questions" element={<QuestionsPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
