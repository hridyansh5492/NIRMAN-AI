import React, { createContext, useContext, useState, useEffect } from 'react'
import type { AuthUser, UserRole } from '../types'
import { authLogin } from '../services/api'

interface AuthContextType {
  user: AuthUser | null
  role: UserRole
  login: (role: 'admin' | 'contractor' | 'subadmin', id: string, password?: string) => Promise<AuthUser>
  logout: () => void
  isLoginModalOpen: boolean
  setLoginModalOpen: (open: boolean) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = 'nirman_auth_user'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      // Clear legacy persistent localStorage user so opening the app defaults to non-contractor, non-admin, non-subadmin (guest)
      localStorage.removeItem(STORAGE_KEY)
      const saved = sessionStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [isLoginModalOpen, setLoginModalOpen] = useState<boolean>(false)

  useEffect(() => {
    try {
      if (user) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      } else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch (e) {
      console.warn('Failed to save auth state to sessionStorage', e)
    }
  }, [user])

  const login = async (role: 'admin' | 'contractor' | 'subadmin', id: string, password?: string): Promise<AuthUser> => {
    const res = await authLogin(role, id, password)
    setUser(res.user)
    setLoginModalOpen(false)
    return res.user
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
  }

  const role: UserRole = user ? user.role : 'guest'

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        login,
        logout,
        isLoginModalOpen,
        setLoginModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
