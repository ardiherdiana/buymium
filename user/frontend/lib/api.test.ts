import { describe, it, expect } from "vitest"
import { resolveImageUrl } from "./api"

describe("resolveImageUrl", () => {
  it("returns null when given null or undefined", () => {
    expect(resolveImageUrl(null)).toBeNull()
    expect(resolveImageUrl(undefined)).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(resolveImageUrl("")).toBeNull()
  })

  it("returns absolute http/https URLs unchanged", () => {
    expect(resolveImageUrl("https://cdn.example.com/foo.png")).toBe(
      "https://cdn.example.com/foo.png"
    )
    expect(resolveImageUrl("http://cdn.example.com/foo.png")).toBe(
      "http://cdn.example.com/foo.png"
    )
  })

  it("prefixes relative paths with the uploads base URL", () => {
    expect(resolveImageUrl("/uploads/product-1.png")).toBe(
      "https://admin.buymium.store/uploads/product-1.png"
    )
  })
})
