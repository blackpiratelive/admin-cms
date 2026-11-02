"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, validatePassword } from "./session";
import { db, ensureDbInitialized } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function loginAction(formData: FormData) {
  const identifier = (formData.get("identifier") as string)?.trim() || "";
  const password = (formData.get("password") as string) || "";

  if (!password) {
    return { error: "Password is required." };
  }

  // 1. Check master password for superadmin (allows username 'admin' or blank identifier)
  if ((!identifier || identifier.toLowerCase() === "admin") && validatePassword(password)) {
    await createSession({
      userId: "superadmin",
      username: "admin",
      role: "superadmin",
    });
    redirect("/");
  }

  // 2. Check users in database
  await ensureDbInitialized();
  const foundUsers = await db
    .select()
    .from(users)
    .where(or(eq(users.username, identifier), eq(users.email, identifier)))
    .limit(1);

  if (foundUsers.length === 0) {
    return { error: "Invalid username/email or password." };
  }

  const user = foundUsers[0];
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return { error: "Invalid username/email or password." };
  }

  await createSession({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role === "superadmin" ? "superadmin" : "user",
  });

  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
