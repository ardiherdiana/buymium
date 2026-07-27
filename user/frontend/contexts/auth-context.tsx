"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"

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
  login: (user: AuthUser, token: string, refreshToken?: string) => void
  logout: () => void
  isLoading: boolean
  authFetch: (path: string, init?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return !payload.exp || Date.now() / 1000 > payload.exp
  } catch {
    return true
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const tokenRef = useRef<string | null>(null)
  const refreshTokenRef = useRef<string | null>(null)

  function login(u: AuthUser, t: string, rt?: string) {
    localStorage.setItem("auth_token", t)
    localStorage.setItem("auth_user", JSON.stringify(u))
    if (rt) {
      localStorage.setItem("auth_refresh_token", rt)
      refreshTokenRef.current = rt
    }
    tokenRef.current = t
    setUser(u)
    setToken(t)
  }

  function logout() {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    localStorage.removeItem("auth_refresh_token")
    tokenRef.current = null
    refreshTokenRef.current = null
    setUser(null)
    setToken(null)
  }

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const rt = refreshTokenRef.current
    if (!rt) return null
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      })
      if (!res.ok) return null
      const data = await res.json() as { token: string; refreshToken: string }
      localStorage.setItem("auth_token", data.token)
      localStorage.setItem("auth_refresh_token", data.refreshToken)
      tokenRef.current = data.token
      refreshTokenRef.current = data.refreshToken
      setToken(data.token)
      return data.token
    } catch {
      return null
    }
  }, [])

  const authFetch = useCallback(async (path: string, init?: RequestInit): Promise<Response> => {
    const doFetch = (bearer: string | null) => fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    })

    let res = await doFetch(tokenRef.current)
    if (res.status === 401) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        res = await doFetch(newToken)
      } else {
        logout()
      }
    }
    return res
  }, [refreshAccessToken])

  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token")
    const storedUser = localStorage.getItem("auth_user")
    const storedRefreshToken = localStorage.getItem("auth_refresh_token")
    refreshTokenRef.current = storedRefreshToken

    async function init() {
      if (!storedToken || !storedUser) {
        setIsLoading(false)
        return
      }
      if (!isTokenExpired(storedToken)) {
        tokenRef.current = storedToken
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
        setIsLoading(false)
        return
      }
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        setUser(JSON.parse(storedUser))
      } else {
        localStorage.removeItem("auth_token")
        localStorage.removeItem("auth_user")
        localStorage.removeItem("auth_refresh_token")
      }
      setIsLoading(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
