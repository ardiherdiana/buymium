import { render, screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AuthProvider, useAuth, type AuthUser } from "./auth-context"

function makeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

const validToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
const expiredToken = makeJwt({ exp: Math.floor(Date.now() / 1000) - 3600 })

const testUser: AuthUser = { id: "1", name: "Budi", email: "budi@example.com" }

function TestConsumer() {
  const { user, token, login, logout, isLoading, authFetch } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? user.email : "none"}</span>
      <span data-testid="token">{token ?? "none"}</span>
      <button onClick={() => login(testUser, validToken, "refresh-1")}>login</button>
      <button onClick={() => logout()}>logout</button>
      <button
        onClick={async () => {
          const res = await authFetch("/some-path")
          ;(window as unknown as { __lastStatus?: number }).__lastStatus = res.status
        }}
      >
        fetch
      </button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  )
}

describe("AuthProvider / useAuth", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("starts loading and restores a valid token+user from localStorage", async () => {
    localStorage.setItem("auth_token", validToken)
    localStorage.setItem("auth_user", JSON.stringify(testUser))
    localStorage.setItem("auth_refresh_token", "refresh-1")

    renderWithProvider()

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
    expect(screen.getByTestId("user").textContent).toBe("budi@example.com")
    expect(screen.getByTestId("token").textContent).toBe(validToken)
  })

  it("has no user/token and finishes loading when localStorage is empty", async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
    expect(screen.getByTestId("user").textContent).toBe("none")
    expect(screen.getByTestId("token").textContent).toBe("none")
  })

  it("refreshes an expired token on init and keeps the user logged in on success", async () => {
    localStorage.setItem("auth_token", expiredToken)
    localStorage.setItem("auth_user", JSON.stringify(testUser))
    localStorage.setItem("auth_refresh_token", "refresh-1")

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: validToken, refreshToken: "refresh-2" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    renderWithProvider()

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
    expect(screen.getByTestId("user").textContent).toBe("budi@example.com")
    expect(screen.getByTestId("token").textContent).toBe(validToken)
    expect(localStorage.getItem("auth_token")).toBe(validToken)
    expect(localStorage.getItem("auth_refresh_token")).toBe("refresh-2")
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({ method: "POST" })
    )
  })

  it("clears storage and logs out when refreshing an expired token fails on init", async () => {
    localStorage.setItem("auth_token", expiredToken)
    localStorage.setItem("auth_user", JSON.stringify(testUser))
    localStorage.setItem("auth_refresh_token", "refresh-1")

    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal("fetch", fetchMock)

    renderWithProvider()

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
    expect(screen.getByTestId("user").textContent).toBe("none")
    expect(localStorage.getItem("auth_token")).toBeNull()
    expect(localStorage.getItem("auth_user")).toBeNull()
    expect(localStorage.getItem("auth_refresh_token")).toBeNull()
  })

  it("login stores tokens/user in localStorage and updates context state", async () => {
    const user = userEvent.setup()
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))

    await user.click(screen.getByText("login"))

    expect(screen.getByTestId("user").textContent).toBe("budi@example.com")
    expect(screen.getByTestId("token").textContent).toBe(validToken)
    expect(localStorage.getItem("auth_token")).toBe(validToken)
    expect(localStorage.getItem("auth_user")).toBe(JSON.stringify(testUser))
    expect(localStorage.getItem("auth_refresh_token")).toBe("refresh-1")
  })

  it("logout clears tokens/user from localStorage and context state", async () => {
    const user = userEvent.setup()
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))

    await user.click(screen.getByText("login"))
    expect(screen.getByTestId("user").textContent).toBe("budi@example.com")

    await user.click(screen.getByText("logout"))

    expect(screen.getByTestId("user").textContent).toBe("none")
    expect(screen.getByTestId("token").textContent).toBe("none")
    expect(localStorage.getItem("auth_token")).toBeNull()
    expect(localStorage.getItem("auth_user")).toBeNull()
    expect(localStorage.getItem("auth_refresh_token")).toBeNull()
  })

  it("authFetch attaches the Authorization header with the current token", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal("fetch", fetchMock)

    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
    await user.click(screen.getByText("login"))

    await act(async () => {
      await user.click(screen.getByText("fetch"))
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/some-path"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${validToken}` }),
      })
    )
  })

  it("authFetch refreshes the token on a 401 and retries the request once", async () => {
    const user = userEvent.setup()
    const newToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 7200 })

    const fetchMock = vi
      .fn()
      // initial request -> 401
      .mockResolvedValueOnce({ ok: false, status: 401 })
      // refresh call -> succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: newToken, refreshToken: "refresh-2" }),
      })
      // retried request -> succeeds
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal("fetch", fetchMock)

    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
    await user.click(screen.getByText("login"))

    await act(async () => {
      await user.click(screen.getByText("fetch"))
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toEqual(expect.stringContaining("/auth/refresh"))
    expect(fetchMock.mock.calls[2][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${newToken}` }),
      })
    )
    expect((window as unknown as { __lastStatus?: number }).__lastStatus).toBe(200)
  })

  it("authFetch forces logout when the refresh also fails", async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false })
    vi.stubGlobal("fetch", fetchMock)

    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
    await user.click(screen.getByText("login"))

    await act(async () => {
      await user.click(screen.getByText("fetch"))
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId("user").textContent).toBe("none")
    expect(screen.getByTestId("token").textContent).toBe("none")
    expect(localStorage.getItem("auth_token")).toBeNull()
    expect(localStorage.getItem("auth_user")).toBeNull()
    expect(localStorage.getItem("auth_refresh_token")).toBeNull()
  })
})
