import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Home() {
  const { user } = useAuth()
  if (user?.role === 'INTERVIEWER') {
    return <Navigate to="/my-rounds" replace />
  }
  return <Navigate to="/candidates" replace />
}
