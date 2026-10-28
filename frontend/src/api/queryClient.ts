import { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "./client";

// Tell TanStack Query what our api.* functions throw, so query.error and
// mutation.error are typed ApiRequestError (not plain Error) everywhere.
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiRequestError;
  }
}

// A 4xx will not change if we ask again (bad id, refused by a rule): fail
// at once. Retry only "no answer" (status 0) and 5xx, at most twice.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

// The ONE cache for the whole app. main.tsx hands it to QueryClientProvider.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // data younger than 30 s is "fresh": no refetch
      retry: shouldRetry,
      refetchOnWindowFocus: true, // the default, kept explicit
    },
    mutations: {
      retry: false, // never repeat a write automatically
    },
  },
});