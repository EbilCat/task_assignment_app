import { TaskCreatePage } from "./pages/TaskCreatePage";
import { TaskListPage } from "./pages/TaskListPage";
import { hrefFor, useRoute } from "./router";

// Two pages and a nav bar. Plain <a href="#/..."> links: the browser changes
// the hash, useRoute() notices and App re-renders with the other page.
export default function App() {
  const route = useRoute();
  return (
    <>
      <nav className="app-nav" aria-label="Pages">
        <a href={hrefFor("list")} aria-current={route === "list" ? "page" : undefined}>
          Tasks
        </a>
        <a href={hrefFor("new")} aria-current={route === "new" ? "page" : undefined}>
          New task
        </a>
      </nav>
      <main>{route === "new" ? <TaskCreatePage /> : <TaskListPage />}</main>
    </>
  );
}