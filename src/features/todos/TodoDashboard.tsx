"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Project, Todo } from "@/db/schema";
import { deleteProject, deleteTodo, saveProject, saveTodo, setTodoCompleted } from "./actions";
import { Check, ChevronDown, FolderPlus, Pencil, Plus, Tag, Trash2 } from "lucide-react";

type TodoForm = {
  title: string; description: string; dueDate: string; priority: "low" | "medium" | "high"; projectId: string; tags: string;
};

const blankTodo: TodoForm = { title: "", description: "", dueDate: "", priority: "medium", projectId: "", tags: "" };

function tagsFor(todo: Todo) {
  try { return JSON.parse(todo.tags) as string[]; } catch { return []; }
}

export function TodoDashboard({ initialTodos, initialProjects }: { initialTodos: Todo[]; initialProjects: Project[] }) {
  const [todos, setTodos] = useState(initialTodos);
  const [projects, setProjects] = useState(initialProjects);
  const [form, setForm] = useState<TodoForm>(blankTodo);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [status, setStatus] = useState<"open" | "completed" | "all">("open");
  const [projectFilter, setProjectFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [isSaving, setIsSaving] = useState(false);

  const knownTags = useMemo(() => [...new Set(todos.flatMap(tagsFor))].sort(), [todos]);
  const projectNameFor = (id: string | null) => projects.find((project) => project.id === id)?.name;
  const visibleTodos = todos.filter((todo) =>
    (status === "all" || (status === "completed" ? todo.completed === 1 : todo.completed === 0)) &&
    (projectFilter === "all" || todo.projectId === projectFilter) &&
    (tagFilter === "all" || tagsFor(todo).includes(tagFilter))
  );

  const updateForm = (key: keyof TodoForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submitTodo(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    const result = await saveTodo({ ...form, id: editingId || undefined });
    setIsSaving(false);
    if (!result.success) return alert(result.error);
    const tags = [...new Set(form.tags.split(",").map((tag) => tag.trim()).filter(Boolean))];
    const now = new Date().toISOString();
    if (editingId) {
      setTodos((current) => current.map((todo) => todo.id === editingId ? { ...todo, title: form.title.trim(), description: form.description.trim() || null, dueDate: form.dueDate || null, priority: form.priority, projectId: form.projectId || null, tags: JSON.stringify(tags), updatedAt: now } : todo));
    } else {
      setTodos((current) => [{ id: result.id!, title: form.title.trim(), description: form.description.trim() || null, dueDate: form.dueDate || null, priority: form.priority, projectId: form.projectId || null, tags: JSON.stringify(tags), completed: 0, createdAt: now, updatedAt: now }, ...current]);
    }
    setForm(blankTodo); setEditingId(null);
  }

  async function submitProject(event: FormEvent) {
    event.preventDefault();
    const result = await saveProject({ name: projectName, description: projectDescription });
    if (!result.success) return alert(result.error);
    setProjects((current) => [...current, { id: "", name: projectName.trim(), description: projectDescription.trim() || null, createdAt: "", updatedAt: "" }]);
    // Refreshing after a server action supplies the authoritative ID for the next selection.
    window.location.reload();
  }

  async function toggleTodo(todo: Todo) {
    const completed = !todo.completed;
    setTodos((current) => current.map((item) => item.id === todo.id ? { ...item, completed: completed ? 1 : 0 } : item));
    await setTodoCompleted(todo.id, completed);
  }

  async function removeTodo(id: string) {
    if (!confirm("Delete this task?")) return;
    setTodos((current) => current.filter((todo) => todo.id !== id));
    await deleteTodo(id);
  }

  async function removeProject(project: Project) {
    if (!confirm(`Delete “${project.name}”? Its tasks will remain unassigned.`)) return;
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setTodos((current) => current.map((todo) => todo.projectId === project.id ? { ...todo, projectId: null } : todo));
    await deleteProject(project.id);
  }

  function beginEdit(todo: Todo) {
    setEditingId(todo.id);
    setForm({ title: todo.title, description: todo.description || "", dueDate: todo.dueDate || "", priority: todo.priority, projectId: todo.projectId || "", tags: tagsFor(todo).join(", ") });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <div style={{ display: "grid", gap: 20 }}>
    <div className="page-header"><h1 className="page-title"><Check size={20} /> Todo list</h1><span style={{ color: "var(--text-muted)" }}>{todos.filter((todo) => !todo.completed).length} open tasks</span></div>
    <div className="todo-layout">
      <form className="todo-card" onSubmit={submitTodo}>
        <h2>{editingId ? "Edit task" : "Add task"}</h2>
        <label className="form-group"><span className="form-label">Task</span><input autoFocus className="text-input" value={form.title} onChange={(e) => updateForm("title", e.target.value)} placeholder="What needs doing?" required /></label>
        <label className="form-group"><span className="form-label">Description</span><textarea className="text-input todo-textarea" value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Add useful context…" /></label>
        <div className="todo-form-grid">
          <label className="form-group"><span className="form-label">Due date</span><input className="text-input" type="date" value={form.dueDate} onChange={(e) => updateForm("dueDate", e.target.value)} /></label>
          <label className="form-group"><span className="form-label">Priority</span><select className="select-input" value={form.priority} onChange={(e) => updateForm("priority", e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        </div>
        <label className="form-group"><span className="form-label">Project</span><select className="select-input" value={form.projectId} onChange={(e) => updateForm("projectId", e.target.value)}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="form-group"><span className="form-label">Tags</span><input className="text-input" list="todo-tags" value={form.tags} onChange={(e) => updateForm("tags", e.target.value)} placeholder="work, home, urgent" /><datalist id="todo-tags">{knownTags.map((tag) => <option value={tag} key={tag} />)}</datalist><small>Separate tags with commas.</small></label>
        <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary" disabled={isSaving}>{isSaving ? "Saving…" : <><Plus size={16} /> {editingId ? "Save task" : "Add task"}</>}</button>{editingId && <button type="button" className="btn" onClick={() => { setEditingId(null); setForm(blankTodo); }}>Cancel</button>}</div>
      </form>
      <aside className="todo-card"><div className="todo-section-heading"><h2>Projects</h2><button type="button" className="btn btn-sm" onClick={() => setShowProjectForm((value) => !value)}><FolderPlus size={14} /> Add</button></div>
        {showProjectForm && <form onSubmit={submitProject} className="project-form"><input className="text-input" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" required /><input className="text-input" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} placeholder="Short description (optional)" /><button className="btn btn-primary btn-sm">Create project</button></form>}
        <div className="project-list">{projects.length ? projects.map((project) => <div className="project-row" key={project.id}><div><strong>{project.name}</strong>{project.description && <small>{project.description}</small>}</div><button aria-label={`Delete ${project.name}`} className="icon-button" onClick={() => removeProject(project)}><Trash2 size={15} /></button></div>) : <p className="empty-copy">Create projects to group your tasks.</p>}</div>
      </aside>
    </div>
    <div className="filter-bar"><select className="select-input todo-filter" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="open">Open tasks</option><option value="completed">Completed tasks</option><option value="all">All tasks</option></select><select className="select-input todo-filter" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="all">All projects</option><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select className="select-input todo-filter" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}><option value="all">All tags</option>{knownTags.map((tag) => <option value={tag} key={tag}>{tag}</option>)}</select></div>
    <section className="todo-list">{visibleTodos.length ? visibleTodos.map((todo) => <article className={`todo-item ${todo.completed ? "is-complete" : ""}`} key={todo.id}><button className="todo-check" onClick={() => toggleTodo(todo)} aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}>{todo.completed && <Check size={15} />}</button><div className="todo-content"><div className="todo-title-row"><strong>{todo.title}</strong><span className={`priority priority-${todo.priority}`}>{todo.priority}</span></div>{todo.description && <p>{todo.description}</p>}<div className="todo-meta">{todo.dueDate && <span className={todo.dueDate < new Date().toISOString().slice(0, 10) && !todo.completed ? "overdue" : ""}>Due {new Date(`${todo.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}{projectNameFor(todo.projectId) && <span>{projectNameFor(todo.projectId)}</span>}{tagsFor(todo).map((tag) => <span className="tag-chip" key={tag}><Tag size={11} />{tag}</span>)}</div></div><div className="todo-actions"><button className="icon-button" aria-label="Edit task" onClick={() => beginEdit(todo)}><Pencil size={15} /></button><button className="icon-button danger" aria-label="Delete task" onClick={() => removeTodo(todo.id)}><Trash2 size={15} /></button></div></article>) : <div className="todo-card empty-copy">No tasks match these filters.</div>}</section>
  </div>;
}
