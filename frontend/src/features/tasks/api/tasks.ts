import { apiFetch } from "@/lib/api";

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "done";

export interface TaskUser {
  id: number;
  name: string;
  role: "owner" | "manager" | "cashier";
}

export interface TaskRow {
  id: number;
  title: string;
  body: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  creator?: TaskUser;
  assignee?: TaskUser;
}

export interface TaskSummary {
  open_assigned: number;
  open_high: number;
}

export function fetchTaskSummary() {
  return apiFetch<TaskSummary>("/tasks/summary");
}

export function listTasks(status?: TaskStatus) {
  const q = status ? `?status=${status}` : "";
  return apiFetch<{ data: TaskRow[] }>(`/tasks${q}`);
}

export function createTask(input: {
  title: string;
  body?: string;
  priority?: TaskPriority;
  due_at?: string | null;
  assigned_to?: number;
}) {
  return apiFetch<{ data: TaskRow }>("/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTask(
  id: number,
  input: Partial<{
    title: string;
    body: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    due_at: string | null;
    assigned_to: number;
  }>,
) {
  return apiFetch<{ data: TaskRow }>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTask(id: number) {
  return apiFetch<{ ok: boolean }>(`/tasks/${id}`, { method: "DELETE" });
}
