"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, validatePassword } from "./session";

export async function loginAction(formData: FormData) {
  const password = formData.get("password") as string;
  if (!password || !validatePassword(password)) {
    return { error: "Invalid password." };
  }

  await createSession();
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
