import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) {
    // preserve the current location so the login page can return here after success
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return children
}
