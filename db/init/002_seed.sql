BEGIN;

-- 1. Lookup tables. Ids are assigned in insert order: 1, 2, ...
INSERT INTO skills (name) VALUES ('Frontend'), ('Backend');

INSERT INTO developers (name) VALUES ('Alice'), ('Bob'), ('Carol'), ('Dave');

-- 2. Who has which skill, written with names and turned into ids by joins.
INSERT INTO developer_skills (developer_id, skill_id)
SELECT d.id, s.id
FROM (VALUES
  ('Alice', 'Frontend'),
  ('Bob',   'Backend'),
  ('Carol', 'Frontend'),
  ('Carol', 'Backend'),
  ('Dave',  'Backend')
) AS v(developer, skill)
JOIN developers d ON d.name = v.developer
JOIN skills     s ON s.name = v.skill;

-- 3. Tasks, one level of the tree at a time (a parent must exist first).
INSERT INTO tasks (title, status, assignee_id) VALUES
  ('Build login page', 'In Progress',
     (SELECT id FROM developers WHERE name = 'Carol'));

INSERT INTO tasks (title, status, assignee_id, parent_task_id) VALUES
  ('Design form UI', 'Done',
     (SELECT id FROM developers WHERE name = 'Alice'),
     (SELECT id FROM tasks WHERE title = 'Build login page')),
  ('Auth API endpoint', 'In Progress',
     (SELECT id FROM developers WHERE name = 'Bob'),
     (SELECT id FROM tasks WHERE title = 'Build login page'));

INSERT INTO tasks (title, status, assignee_id, parent_task_id) VALUES
  ('Hash passwords', 'To Do',
     (SELECT id FROM developers WHERE name = 'Dave'),
     (SELECT id FROM tasks WHERE title = 'Auth API endpoint')),
  ('Write README', 'To Do', NULL, NULL);

-- 4. Required skills per task. "Write README" gets none on purpose:
--    it is the task the LLM step will fill in later.
INSERT INTO task_skills (task_id, skill_id)
SELECT t.id, s.id
FROM (VALUES
  ('Build login page',  'Frontend'),
  ('Build login page',  'Backend'),
  ('Design form UI',    'Frontend'),
  ('Auth API endpoint', 'Backend'),
  ('Hash passwords',    'Backend')
) AS v(task, skill)
JOIN tasks  t ON t.title = v.task
JOIN skills s ON s.name  = v.skill;

COMMIT;