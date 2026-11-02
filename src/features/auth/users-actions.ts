"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "./session";
import { db, ensureDbInitialized } from "@/db";
import { users } from "@/db/schema";
import { eq, or, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface SafeUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  createdAt: string;
}

export async function createAccountAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== "superadmin") {
    return { error: "Unauthorized: Only Super Admin can create accounts." };
  }

  const rawUsername = (formData.get("username") as string)?.trim() || "";
  const rawEmail = (formData.get("email") as string)?.trim() || "";
  const password = (formData.get("password") as string) || "";

  const username = rawUsername.toLowerCase();
  const email = rawEmail.toLowerCase();

  // Validate username
  if (!username) {
    return { error: "Username is required." };
  }
  if (username.length < 3) {
    return { error: "Username must be at least 3 characters." };
  }
  if (!/^[a-z0-9_-]+$/.test(username)) {
    return { error: "Username may only contain letters, numbers, underscores, and hyphens." };
  }
  if (username === "admin" || username === "superadmin") {
    return { error: "Username 'admin' is reserved for Super Admin." };
  }

  // Validate optional email
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  // Validate password
  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  await ensureDbInitialized();

  // Check username uniqueness
  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUsername.length > 0) {
    return { error: `Username '${username}' is already taken.` };
  }

  // Check email uniqueness if email provided
  if (email) {
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      return { error: `Email '${email}' is already registered.` };
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(users).values({
    id,
    username,
    email: email || null,
    passwordHash,
    role: "user",
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/settings/users");
  return {
    success: true,
    user: {
      id,
      username,
      email: email || null,
      role: "user",
      createdAt: now,
    },
  };
}

export async function getUsersListAction(): Promise<SafeUser[]> {
  const session = await getSessionUser();
  if (!session || session.role !== "superadmin") {
    return [];
  }

  await ensureDbInitialized();
  const records = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return records;
}

export async function deleteUserAction(userId: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "superadmin") {
    return { error: "Unauthorized: Only Super Admin can delete accounts." };
  }

  if (userId === session.userId || userId === "superadmin") {
    return { error: "Cannot delete the active Super Admin account." };
  }

  await ensureDbInitialized();
  await db.delete(users).where(eq(users.id, userId));

  revalidatePath("/settings/users");
  return { success: true };
}
