import { cloneElement, type ReactElement, type ReactNode } from "react";

import { Label } from "@/components/ui/label";

type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
};

/**
 * Label + control + hint + error, wired up for screen readers.
 *
 * Pass exactly one control (Input, Textarea, Checkbox, ...) as the child.
 * FormField gives it the `id`, links the hint and error with
 * `aria-describedby`, and sets `aria-invalid` when there is an error.
 *
 * When the focusable element is nested (a Select's trigger), pass a function
 * instead and spread the props onto that element:
 *   <FormField id="grade" label="Grade">
 *     {(p) => <Select><SelectTrigger {...p}>…</SelectTrigger>…</Select>}
 *   </FormField>
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactElement<ControlProps> | ((controlProps: ControlProps) => ReactNode);
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ");

  const controlProps: ControlProps = { id };
  if (describedBy) controlProps["aria-describedby"] = describedBy;
  if (error) controlProps["aria-invalid"] = true;
  if (required) controlProps.required = true;

  return (
    <div className="form-field">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="form-required" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {typeof children === "function"
        ? children(controlProps)
        : cloneElement(children, controlProps)}
      {hint ? (
        <p id={hintId} className="form-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
