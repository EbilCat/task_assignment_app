import type { InferenceReport, LlmFailure } from "../api/types";

// Plain-language reasons for the user (the server log has the details).
const WHY: Record<LlmFailure, string> = {
  no_key: "no GEMINI_API_KEY is set on the server",
  timeout: "Gemini did not answer in time",
  api_error: "Gemini returned an error",
  empty: "Gemini returned no answer",
  bad_json: "Gemini's answer was not JSON",
  bad_shape: "Gemini's answer did not match the expected shape",
};

// Shown after a create: which skills were suggested, or why none were.
// Nothing when every node had skills ticked (no call was made).
export function InferenceNote({ inference }: { inference: InferenceReport }) {
  if (inference.status === "skipped") return null;

  if (inference.status === "failed") {
    return (
      <p className="inference-note">
        Skill suggestions were skipped ({WHY[inference.reason]}). Tasks with no skills ticked were saved with
        none, so any developer may take them.
      </p>
    );
  }

  return (
    <div className="inference-note">
      <p>Skills suggested from the titles:</p>
      <ul>
        {inference.inferred.map((item) => (
          <li key={item.path || "root"}>
            {item.title}: {item.skills.length > 0 ? item.skills.join(", ") : "none needed"}
          </li>
        ))}
      </ul>
    </div>
  );
}