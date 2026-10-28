import { useSyncExternalStore } from "react";

// Two pages, chosen by the URL hash: "#/" (or no hash) = Task List,
// "#/new" = Task Creation. Changing the hash never reloads the page, so the
// TanStack Query cache survives, and Back/Forward and refresh just work.
// No router library: two routes don't need one.
export type Route = "list" | "new";

function readRoute(): Route {
  return window.location.hash === "#/new" ? "new" : "list";
}

// useSyncExternalStore re-renders whoever calls useRoute() whenever the
// browser fires "hashchange" (link click, Back, typing the URL).
function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, readRoute);
}

export function hrefFor(route: Route): string {
  return route === "new" ? "#/new" : "#/";
}