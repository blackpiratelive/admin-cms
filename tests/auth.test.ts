import { describe, it, expect } from "vitest";
import { validatePassword, verifySessionToken } from "@/features/auth/session";

describe("Auth & Session Management", () => {
  it("validates admin password against environment variable or fallback", () => {
    // Default fallback password when ADMIN_PASSWORD is unset is "admin123"
    expect(validatePassword("admin123")).toBe(true);
    expect(validatePassword("wrongpassword")).toBe(false);
  });

  it("fails verification for invalid or malformed tokens", async () => {
    const invalidToken = "invalid.jwt.token";
    const result = await verifySessionToken(invalidToken);
    expect(result).toBe(false);
  });
});
