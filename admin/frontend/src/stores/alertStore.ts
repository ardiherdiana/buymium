import { create } from "zustand"

type AlertState = {
  alertOpen: boolean
  alertTitle: string
  alertMessage: string
  confirmOpen: boolean
  confirmTitle: string
  confirmMessage: string
  confirmResolve: ((ok: boolean) => void) | null
  showAlert: (opts: { title?: string; message: string }) => void
  showConfirm: (opts: { title: string; message: string }) => Promise<boolean>
  closeAlert: () => void
  resolveConfirm: (ok: boolean) => void
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alertOpen: false,
  alertTitle: "",
  alertMessage: "",
  confirmOpen: false,
  confirmTitle: "",
  confirmMessage: "",
  confirmResolve: null,

  showAlert: ({ title = "Info", message }) => {
    set({ alertOpen: true, alertTitle: title, alertMessage: message })
  },

  showConfirm: ({ title, message }) =>
    new Promise<boolean>((resolve) => {
      set({
        confirmOpen: true,
        confirmTitle: title,
        confirmMessage: message,
        confirmResolve: resolve,
      })
    }),

  closeAlert: () => set({ alertOpen: false }),

  resolveConfirm: (ok) => {
    const { confirmResolve } = get()
    set({ confirmOpen: false, confirmResolve: null })
    confirmResolve?.(ok)
  },
}))

// Convenience helpers matching reference's useAlertStore API
export function useAlert() {
  const store = useAlertStore()
  return {
    success: (title: string, message: string) =>
      store.showAlert({ title, message }),
    error: (title: string, message: string) =>
      store.showAlert({ title, message }),
    confirm: (title: string, message: string) =>
      store.showConfirm({ title, message }),
  }
}
