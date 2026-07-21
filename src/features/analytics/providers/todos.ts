import { db, ensureDbInitialized } from "@/db";
import { todos, projects } from "@/db/schema";
import { AnalyticsProvider, TodoAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";
import { getTimeFilterStartEnd } from "../config";

export const todoAnalyticsProvider: AnalyticsProvider = {
  name: "todos",
  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<TodoAnalyticsData> => {
    await ensureDbInitialized();

    const [allTodos, allProjects] = await Promise.all([
      db.select().from(todos),
      db.select().from(projects),
    ]);

    const projMap = new Map(allProjects.map((p) => [p.id, p.name]));

    let filtered = allTodos;
    const { start, end } = getTimeFilterStartEnd(timeFilter, customRange);
    if (start || end) {
      filtered = allTodos.filter((t) => {
        const d = new Date(t.createdAt);
        if (isNaN(d.getTime())) return true;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    const totalTasks = filtered.length;
    let completedTasks = 0;
    let pendingTasks = 0;
    let overdueTasksCount = 0;
    let completedToday = 0;
    let completedThisWeek = 0;
    let completedThisMonth = 0;

    const priorityCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    const projectCounts: Record<string, number> = {};

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    filtered.forEach((t) => {
      if (t.completed) {
        completedTasks += 1;
        const updTime = new Date(t.updatedAt).getTime();
        if (!isNaN(updTime)) {
          if (updTime >= todayStart) completedToday += 1;
          if (updTime >= weekStart) completedThisWeek += 1;
          if (updTime >= monthStart) completedThisMonth += 1;
        }
      } else {
        pendingTasks += 1;
        if (t.dueDate) {
          const due = new Date(t.dueDate).getTime();
          if (!isNaN(due) && due < Date.now()) {
            overdueTasksCount += 1;
          }
        }
      }

      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;

      if (t.projectId) {
        const pName = projMap.get(t.projectId) || t.projectId;
        projectCounts[pName] = (projectCounts[pName] || 0) + 1;
      }

      try {
        const tags: string[] = JSON.parse(t.tags || "[]");
        tags.forEach((tag) => (tagCounts[tag] = (tagCounts[tag] || 0) + 1));
      } catch (err) {}
    });

    const completionRatePercent = totalTasks > 0 ? Number(((completedTasks / totalTasks) * 100).toFixed(1)) : 0;

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      completionRatePercent,
      averageCompletionTimeHours: 24, // baseline fallback estimation
      tasksByPriority: Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count })),
      tasksByTag: Object.entries(tagCounts).map(([tag, count]) => ({ tag, count })),
      tasksByProject: Object.entries(projectCounts).map(([project, count]) => ({ project, count })),
      overdueTasksCount,
      completedToday,
      completedThisWeek,
      completedThisMonth,
    };
  },
};
