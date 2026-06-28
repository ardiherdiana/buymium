"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export interface AuthUser {
  id: string
  name: string
  email: string
  avatar?: string
  hasPassword?: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (user: AuthUser, token: string) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token")
    const storedUser = localStorage.getItem("auth_user")
    if (storedToken && storedUser) {
      try {
        const payload = JSON.parse(atob(storedToken.split(".")[1]))
        const isExpired = payload.exp && Date.now() / 1000 > payload.exp
        if (isExpired) {
          localStorage.removeItem("auth_token")
          localStorage.removeItem("auth_user")
        } else {
          setToken(storedToken)
          setUser(JSON.parse(storedUser))
        }
      } catch {
        localStorage.removeItem("auth_token")
        localStorage.removeItem("auth_user")
      }
    }
    setIsLoading(false)
  }, [])

  function login(u: AuthUser, t: string) {
    localStorage.setItem("auth_token", t)
    localStorage.setItem("auth_user", JSON.stringify(u))
    setUser(u)
    setToken(t)
  }

  function logout() {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
