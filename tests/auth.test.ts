// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validatePassword,
  verifySessionToken,
  generateSessionToken,
  verifyAndDecodeSession,
  type SessionUser,
} from "@/features/auth/session";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

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
    const decoded = await verifyAndDecodeSession(invalidToken);
    expect(decoded).toBeNull();
  });

  it("generates and verifies superadmin session token", async () => {
    const token = await generateSessionToken({
      userId: "superadmin",
      username: "admin",
      role: "superadmin",
    });
    expect(typeof token).toBe("string");

    const isValid = await verifySessionToken(token);
    expect(isValid).toBe(true);

    const user = await verifyAndDecodeSession(token);
    expect(user).not.toBeNull();
    expect(user?.role).toBe("superadmin");
    expect(user?.username).toBe("admin");
  });

  it("generates and verifies regular user session token with username and email", async () => {
    const sessionUser: SessionUser = {
      userId: "user-12345",
      username: "friend_dev",
      email: "friend@example.com",
      role: "user",
    };
    const token = await generateSessionToken(sessionUser);
    expect(typeof token).toBe("string");

    const decoded = await verifyAndDecodeSession(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe("user-12345");
    expect(decoded?.username).toBe("friend_dev");
    expect(decoded?.email).toBe("friend@example.com");
    expect(decoded?.role).toBe("user");
  });

  it("normalizes legacy JWT tokens with role 'admin' to 'superadmin'", async () => {
    const secretKey = new TextEncoder().encode(
      process.env.SESSION_SECRET || "admin-cms-super-secret-key-32charsmin!!"
    );
    const legacyToken = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1d")
      .sign(secretKey);

    const decoded = await verifyAndDecodeSession(legacyToken);
    expect(decoded).not.toBeNull();
    expect(decoded?.role).toBe("superadmin");
    expect(decoded?.username).toBe("admin");
  });

  it("hashes and validates passwords using bcryptjs", async () => {
    const plain = "mySecretPassword123";
    const hash = await bcrypt.hash(plain, 10);
    expect(hash).not.toBe(plain);
    expect(hash.startsWith("$2")).toBe(true);

    const isMatch = await bcrypt.compare(plain, hash);
    expect(isMatch).toBe(true);

    const isWrong = await bcrypt.compare("wrongPassword", hash);
    expect(isWrong).toBe(false);
  });
});
