"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, ensureDbInitialized } from "@/db";
import { projects, todos } from "@/db/schema";

function parseTags(value: string | string[]) {
  const tags = Array.isArray(value) ? value : value.split(",");
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function refresh() {
  revalidatePath("/todos");
  revalidatePath("/");
}

export async function getTodoData() {
  try {
    await ensureDbInitialized();
    const [items, projectItems] = await Promise.all([
      db.select().from(todos).orderBy(todos.completed, todos.dueDate, desc(todos.createdAt)),
      db.select().from(projects).orderBy(projects.name),
    ]);
    return { items, projects: projectItems };
  } catch (error) {
    console.error("Unable to load todos:", error);
    return { items: [], projects: [] };
  }
}

export async function saveTodo(input: {
  id?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  projectId?: string;
  tags?: string | string[];
}) {
  await ensureDbInitialized();
  const title = input.title.trim();
  if (!title) return { success: false, error: "A task title is required." };

  const now = new Date().toISOString();
  const id = input.id || crypto.randomUUID();
  const values = {
    title,
    description: input.description?.trim() || null,
    dueDate: input.dueDate || null,
    priority: input.priority || "medium",
    projectId: input.projectId || null,
    tags: JSON.stringify(parseTags(input.tags || [])),
    updatedAt: now,
  };

  const existing = input.id
    ? (await db.select().from(todos).where(eq(todos.id, id)))[0]
    : null;
  if (existing) {
    await db.update(todos).set(values).where(eq(todos.id, id));
  } else {
    await db.insert(todos).values({ ...values, id, completed: 0, createdAt: now });
  }
  refresh();
  return { success: true, id };
}

export async function setTodoCompleted(id: string, completed: boolean) {
  await ensureDbInitialized();
  await db.update(todos).set({ completed: completed ? 1 : 0, updatedAt: new Date().toISOString() }).where(eq(todos.id, id));
  refresh();
  return { success: true };
}

export async function deleteTodo(id: string) {
  await ensureDbInitialized();
  await db.delete(todos).where(eq(todos.id, id));
  refresh();
  return { success: true };
}

export async function saveProject(input: { id?: string; name: string; description?: string }) {
  await ensureDbInitialized();
  const name = input.name.trim();
  if (!name) return { success: false, error: "A project name is required." };
  const now = new Date().toISOString();
  try {
    if (input.id) {
      await db.update(projects).set({ name, description: input.description?.trim() || null, updatedAt: now }).where(eq(projects.id, input.id));
    } else {
      await db.insert(projects).values({ id: crypto.randomUUID(), name, description: input.description?.trim() || null, createdAt: now, updatedAt: now });
    }
    refresh();
    return { success: true };
  } catch {
    return { success: false, error: "A project with that name already exists." };
  }
}

export async function deleteProject(id: string) {
  await ensureDbInitialized();
  await db.transaction(async (tx) => {
    await tx.update(todos).set({ projectId: null, updatedAt: new Date().toISOString() }).where(eq(todos.projectId, id));
    await tx.delete(projects).where(eq(projects.id, id));
  });
  refresh();
  return { success: true };
}
