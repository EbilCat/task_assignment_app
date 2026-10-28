import type { Skill } from "../api/types";
import { FieldError } from "./FieldError";

type Props = {
  idPrefix: string; // keeps ids unique when several pickers are on one page (subtasks, next lesson)
  skills: Skill[]; // from GET /skills
  selected: string[]; // ticked skill names (the parent's draft owns them)
  onChange: (names: string[]) => void;
  error?: string;
  onDismissError: () => void;
};

// Checkboxes for the skills a task requires. CONTROLLED: it shows `selected`
// and reports changes; it keeps no state of its own.
export function SkillPicker({ idPrefix, skills, selected, onChange, error, onDismissError }: Props) {
  const errorId = `${idPrefix}-skills-error`;

  function toggle(name: string, on: boolean) {
    const next = on ? [...selected, name] : selected.filter((s) => s !== name);
    // Keep GET /skills order, whatever order the boxes were clicked in.
    onChange(skills.map((s) => s.name).filter((n) => next.includes(n)));
  }

  return (
    <fieldset className="skill-picker" aria-describedby={error ? errorId : undefined}>
      <legend>Required skills</legend>
      {skills.map((s) => {
        const id = `${idPrefix}-skill-${s.id}`;
        return (
          <label key={s.id} htmlFor={id} className="check">
            <input
              id={id}
              type="checkbox"
              checked={selected.includes(s.name)}
              onChange={(e) => toggle(s.name, e.target.checked)}
            />
            {s.name}
          </label>
        );
      })}
      <small className="hint">None ticked: any developer may take it.</small>
      {error && <FieldError id={errorId} message={error} onDismiss={onDismissError} />}
    </fieldset>
  );
}