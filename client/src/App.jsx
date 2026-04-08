import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { CandidateList } from './pages/CandidateList'
import { CandidateNew } from './pages/CandidateNew'
import { CandidateDetail } from './pages/CandidateDetail'
import { CreateTemplate } from './pages/CreateTemplate'
import { InterviewRoundPage } from './pages/InterviewRoundPage'
import { AdminDashboard } from './pages/AdminDashboard'
import { WaitingApproval } from './pages/WaitingApproval'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout /> }>
            <Route path="/" element={<Home />} />
            <Route path="/candidates" element={<CandidateList />} />
            <Route
              path="/candidates/new"
              element={
                <ProtectedRoute roles={['RECRUITER']}>
                  <CandidateNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/candidates/:id"
              element={
                <ProtectedRoute roles={['RECRUITER']}>
                  <CandidateDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates/new"
              element={
                <ProtectedRoute roles={['RECRUITER']}>
                  <CreateTemplate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-rounds"
              element={
                <ProtectedRoute roles={['INTERVIEWER']}>
                  <InterviewRoundPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/pending" element={<WaitingApproval />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
