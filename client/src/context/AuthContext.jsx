import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import { setAuthToken } from '../api/client'

const AuthContext = createContext(null)

const STORAGE_KEY = 'hiring_token'
const USER_KEY = 'hiring_user'

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(STORAGE_KEY))
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  })

  useEffect(() => {
    setAuthToken(token)
  }, [token])

  const login = useCallback((newToken, profile) => {
    localStorage.setItem(STORAGE_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(profile))
    setTokenState(newToken)
    setUser(profile)
    setAuthToken(newToken)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(USER_KEY)
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
