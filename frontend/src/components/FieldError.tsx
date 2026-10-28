// The red line under a control whose last save was refused.
// role="alert" makes screen readers announce it when it appears.
export function FieldError({ id, message, onDismiss }: { id: string; message: string; onDismiss: () => void }) {
  return (
    <p id={id} role="alert" className="field-error">
      <span>{message}</span>
      <button type="button" className="dismiss" onClick={onDismiss} aria-label="Dismiss error">
        ×
      </button>
    </p>
  );
}