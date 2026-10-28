import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./endpoints";
import type { CreateTaskInput, TaskStatus } from "./types";

// Every cache key in one place. Keys are arrays, matched by PREFIX:
// invalidating ["tasks"] also hits ["tasks", 3, "qualified-developers"].
export const queryKeys = {
  tasks: ["tasks"] as const,
  qualifiedDevelopers: (taskId: number) => ["tasks", taskId, "qualified-developers"] as const,
  developers: ["developers"] as const,
  skills: ["skills"] as const,
};

// ---- reads ---------------------------------------------------------------

export function useTasks() {
  return useQuery({ queryKey: queryKeys.tasks, queryFn: api.listTasks });
}

// Developers and skills only change when the seed changes: keep them 5 min.
export function useDevelopers() {
  return useQuery({ queryKey: queryKeys.developers, queryFn: api.listDevelopers, staleTime: 5 * 60_000 });
}

export function useSkills() {
  return useQuery({ queryKey: queryKeys.skills, queryFn: api.listSkills, staleTime: 5 * 60_000 });
}

// For the assignee dropdown (next lesson). `enabled: false` = don't fetch
// until the dropdown is actually opened.
export function useQualifiedDevelopers(taskId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.qualifiedDevelopers(taskId),
    queryFn: () => api.qualifiedDevelopers(taskId),
    enabled,
  });
}

// ---- writes --------------------------------------------------------------
// After a successful write the cached tree is out of date, so we invalidate
// ["tasks"]: every active query under that prefix refetches. Returning the
// promise keeps isPending true until the fresh tree has arrived.

export function useAssignTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, assigneeId }: { taskId: number; assigneeId: number | null }) =>
      api.assignTask(taskId, assigneeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
  });
}

export function useSetStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) => api.setStatus(taskId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
  });
}


// ...
// POST /tasks. A new task changes the tree, so refresh ["tasks"]. The new
// Task comes back as mutation.data (and in mutate's own onSuccess).
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.createTask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
  });
}