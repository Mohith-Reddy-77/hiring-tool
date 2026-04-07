import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import { setAuthToken } from '../api/client'

const AuthContext = createContext(null)

const STORAGE_KEY = 'hiring_token'
const USER_KEY = 'hiring_user'

export function AuthProvider({ children }) {
  // Use sessionStorage so the auth session is scoped to this tab and survives reloads
  const [token, setTokenState] = useState(() => sessionStorage.getItem(STORAGE_KEY))
  const [user, setUser] = useState(() => {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  })

  useEffect(() => {
    setAuthToken(token)
  }, [token])

  const login = useCallback((newToken, profile) => {
    sessionStorage.setItem(STORAGE_KEY, newToken)
    sessionStorage.setItem(USER_KEY, JSON.stringify(profile))
    setTokenState(newToken)
    setUser(profile)
    setAuthToken(newToken)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(USER_KEY)
    setTokenState(null)
    setUser(null)
    setAuthToken(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, user, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
