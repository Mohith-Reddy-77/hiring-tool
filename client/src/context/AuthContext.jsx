import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import { setAuthToken } from '../api/client'
import { authApi } from '../api/hiringApi'

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

  // When a token exists on mount, refresh the user profile from the server
  useEffect(() => {
    if (!token) return
    let mounted = true
    authApi
      .me()
      .then((res) => {
        if (!mounted) return
        if (res && res.data) {
          // res.data may include a refreshed token and user profile
          const newToken = res.data.token
          const profile = res.data.user
          if (newToken) {
            sessionStorage.setItem(STORAGE_KEY, newToken)
            setTokenState(newToken)
            setAuthToken(newToken)
          }
          if (profile) {
            sessionStorage.setItem(USER_KEY, JSON.stringify(profile))
            // update local state to reflect any role changes made by admin
            setUser(profile)
          }
        }
      })
      .catch(() => {
        // ignore errors — token may be invalid; login will handle
      })
    return () => {
      mounted = false
    }
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
