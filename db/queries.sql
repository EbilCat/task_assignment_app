-- db/queries.sql  (not in db/init, so it never runs at container start)
\set task_id 1
\echo === qualified developers for task :task_id ===
SELECT d.id, d.name
FROM developers d
WHERE NOT EXISTS (
  SELECT 1 FROM task_skills ts
  WHERE ts.task_id = :task_id
    AND NOT EXISTS (SELECT 1 FROM developer_skills ds
                    WHERE ds.developer_id = d.id AND ds.skill_id = ts.skill_id))
ORDER BY d.id;

\echo === descendants of task :task_id ===
WITH RECURSIVE subtree AS (
  SELECT id, title, status, 1 AS depth FROM tasks WHERE parent_task_id = :task_id
  UNION ALL
  SELECT t.id, t.title, t.status, s.depth + 1
  FROM tasks t JOIN subtree s ON t.parent_task_id = s.id
)
SELECT * FROM subtree ORDER BY depth, id;

\echo === can task :task_id be marked Done? ===
WITH RECURSIVE subtree AS (
  SELECT id, status FROM tasks WHERE parent_task_id = :task_id
  UNION ALL
  SELECT t.id, t.status FROM tasks t JOIN subtree s ON t.parent_task_id = s.id
)
SELECT COUNT(*) FILTER (WHERE status <> 'Done') = 0 AS can_be_done
FROM subtree;