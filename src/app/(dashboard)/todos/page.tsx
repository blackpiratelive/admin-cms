import { getTodoData } from "@/features/todos/actions";
import { TodoDashboard } from "@/features/todos/TodoDashboard";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const data = await getTodoData();
  return <TodoDashboard initialTodos={data.items} initialProjects={data.projects} />;
}
