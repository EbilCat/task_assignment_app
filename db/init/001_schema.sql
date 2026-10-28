CREATE TABLE developers (
  id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE skills (
  id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE developer_skills (
  developer_id integer NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  skill_id     integer NOT NULL REFERENCES skills(id)     ON DELETE CASCADE,
  PRIMARY KEY (developer_id, skill_id)
);

CREATE TABLE tasks (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title          text NOT NULL CHECK (length(trim(title)) > 0),
  status         text NOT NULL DEFAULT 'To Do'
                 CHECK (status IN ('To Do', 'In Progress', 'Done')),
  assignee_id    integer REFERENCES developers(id) ON DELETE SET NULL,
  parent_task_id integer REFERENCES tasks(id)      ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_task_id IS NULL OR parent_task_id <> id)
);

CREATE TABLE task_skills (
  task_id  integer NOT NULL REFERENCES tasks(id)  ON DELETE CASCADE,
  skill_id integer NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (task_id, skill_id)
);

-- Postgres does not index foreign key columns for you.
CREATE INDEX tasks_parent_task_id_idx      ON tasks(parent_task_id);
CREATE INDEX tasks_assignee_id_idx         ON tasks(assignee_id);
CREATE INDEX task_skills_skill_id_idx      ON task_skills(skill_id);
CREATE INDEX developer_skills_skill_id_idx ON developer_skills(skill_id);