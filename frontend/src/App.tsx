import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/assess/:token" element={<LandingPage />} />
          <Route path="/assess/:token/pillars" element={<PillarSelectPage />} />
          <Route path="/assess/:token/assessment/:assessmentId" element={<AssessmentPage />} />
          <Route path="/assess/:token/report/:assessmentId" element={<ReportPage />} />
          <Route path="/dashboard" element={<AccountsListPage />} />
          <Route path="/dashboard/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/dashboard/assessments/:id" element={<ReportDetailPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/pillars" element={<PillarsPage />} />
          <Route path="/admin/pillars/:id/questions" element={<QuestionsPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
