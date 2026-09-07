import React, { createContext, useContext, useEffect, useState } from 'react'
import type { SessionUser } from '../../main/ipc/types'

interface AuthContextType {
  user: SessionUser | null
  hasInstitution: boolean | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  checkInstitution: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [hasInstitution, setHasInstitution] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const checkInstitution = async (): Promise<boolean> => {
    try {
      const inst = await window.api.institution.get()
      const exists = !!inst
      setHasInstitution(exists)
      return exists
    } catch {
      setHasInstitution(false)
      return false
    }
  }

  const refreshUser = async () => {
    try {
      await checkInstitution()
      const current = await window.api.auth.getCurrentUser()
      setUser(current)
    } catch (err) {
      console.error('Failed to get current user:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const result = await window.api.auth.login(username, password)
      if (result.success) {
        await refreshUser()
      }
      return result
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Login failed unexpectedly',
      }
    }
  }

  const logout = async () => {
    try {
      await window.api.auth.logout()
      setUser(null)
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, hasInstitution, loading, login, logout, refreshUser, checkInstitution }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
