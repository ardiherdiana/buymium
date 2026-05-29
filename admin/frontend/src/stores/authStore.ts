import { create } from "zustand"
import { persist } from "zustand/middleware"

type User = {
  id: number
  name: string
  email: string
  role: string
  roleId: number
  avatar: string | null
}

type AuthState = {
  user: User | null
  token: string | null
  refreshToken: string | null
  setAuth: (user: User, token: string, refreshToken: string) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      setAuth: (user, token, refreshToken) => {
        localStorage.setItem("token", token)
        localStorage.setItem("refreshToken", refreshToken)
        set({ user, token, refreshToken })
      },
      logout: () => {
        localStorage.removeItem("token")
        localStorage.removeItem("refreshToken")
        set({ user: null, token: null, refreshToken: null })
      },
      isAuthenticated: () => !!get().token && !!get().user,
    }),
    { name: "auth-store" }
  )
)
