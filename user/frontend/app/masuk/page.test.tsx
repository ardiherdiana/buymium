import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import MasukPage from "./page"

const pushMock = vi.fn()
const loginMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ login: loginMock }),
}))

vi.mock("@/components/google-signin-button", () => ({
  GoogleSignInButton: () => <div data-testid="google-signin-button" />,
}))

vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: Record<string, unknown>) => <img {...(props as any)} />,
}))

function getSubmitButton() {
  return screen.getAllByRole("button", { name: /^masuk$/i }).find(
    (btn) => btn.getAttribute("type") === "submit"
  ) as HTMLButtonElement
}

describe("MasukPage", () => {
  beforeEach(() => {
    pushMock.mockReset()
    loginMock.mockReset()
    vi.restoreAllMocks()
  })

  it("renders the login form by default", () => {
    render(<MasukPage />)
    expect(screen.getByRole("heading", { name: /masuk ke buymium/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/email@contoh.com/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/password kamu/i)).toBeInTheDocument()
    expect(getSubmitButton()).toBeInTheDocument()
  })

  it("requires email and password before the browser allows submission", async () => {
    render(<MasukPage />)
    const emailInput = screen.getByPlaceholderText(/email@contoh.com/i) as HTMLInputElement
    const passwordInput = screen.getByPlaceholderText(/password kamu/i) as HTMLInputElement
    expect(emailInput).toBeRequired()
    expect(passwordInput).toBeRequired()
  })

  it("logs in and redirects to /dashboard on successful submit", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: "1", name: "Budi", email: "budi@example.com" },
        token: "fake-token",
        refreshToken: "fake-refresh-token",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<MasukPage />)

    await user.type(screen.getByPlaceholderText(/email@contoh.com/i), "budi@example.com")
    await user.type(screen.getByPlaceholderText(/password kamu/i), "supersecret")
    await user.click(getSubmitButton())

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1))
    expect(loginMock).toHaveBeenCalledWith(
      { id: "1", name: "Budi", email: "budi@example.com" },
      "fake-token",
      "fake-refresh-token"
    )
    expect(pushMock).toHaveBeenCalledWith("/dashboard")

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "budi@example.com", password: "supersecret" }),
      })
    )
  })

  it("shows an error message and does not redirect when login fails", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Email atau password salah" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<MasukPage />)

    await user.type(screen.getByPlaceholderText(/email@contoh.com/i), "budi@example.com")
    await user.type(screen.getByPlaceholderText(/password kamu/i), "wrongpass")
    await user.click(getSubmitButton())

    expect(await screen.findByText(/email atau password salah/i)).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
