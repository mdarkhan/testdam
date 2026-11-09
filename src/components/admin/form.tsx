"use client";
// Small form kit for admin server actions: error summary, per-field errors, pending state.
import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { btn } from "./styles";

export type FormState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string> } | null;
type Action = (prev: FormState, data: FormData) => Promise<FormState>;

const ErrorsContext = createContext<Record<string, string>>({});
const PendingContext = createContext(false);

export function ActionForm({ action, children, className, resetOnSuccess }: { action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
    if (state && !state.ok) summaryRef.current?.focus();
  }, [state, resetOnSuccess]);

  // Submitting via onSubmit (not the `action` prop) stops React from clearing the inputs
  // after a failed save, so nobody has to retype a form because of one bad field.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={className} noValidate>
      <PendingContext.Provider value={pending}>
      <div ref={summaryRef} tabIndex={-1} role={state && !state.ok ? "alert" : "status"} aria-live="polite">
        {state?.message && (
          <div className={`mb-3 rounded-md px-3 py-2 text-sm ${state.ok ? "bg-cheapest-soft text-cheapest" : "bg-danger-soft text-danger"}`}>
            <p>{state.message}</p>
            {state.fieldErrors && (
              <ul className="mt-1 list-disc pl-5">
                {Object.entries(state.fieldErrors).map(([name, msg]) => (
                  <li key={name}><a href={`#f-${name}`} className="underline">{msg}</a></li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <ErrorsContext.Provider value={state?.fieldErrors ?? {}}>{children}</ErrorsContext.Provider>
      </PendingContext.Provider>
    </form>
  );
}

const inputCls = "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-primary aria-[invalid=true]:border-danger";

export function Field({
  label, name, hint, required, ...rest
}: { label: string; name: string; hint?: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const err = useContext(ErrorsContext)[name];
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label} {required && <span className="text-danger" aria-hidden>*</span>}
      </label>
      <input id={id} name={name} required={required} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : hint ? `${id}-hint` : undefined} className={inputCls} {...rest} />
      {hint && !err && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {err && <p id={`${id}-err`} className="mt-1 text-sm text-danger">{err}</p>}
    </div>
  );
}

export function TextArea({ label, name, hint, ...rest }: { label: string; name: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const err = useContext(ErrorsContext)[name];
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      <textarea id={id} name={name} aria-invalid={!!err} aria-describedby={`${id}-hint`} className={inputCls} {...rest} />
      {hint && !err && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {err && <p className="mt-1 text-sm text-danger">{err}</p>}
    </div>
  );
}

export function Select({ label, name, children, ...rest }: { label: string; name: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const err = useContext(ErrorsContext)[name];
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      <select id={id} name={name} aria-invalid={!!err} className={inputCls} {...rest}>{children}</select>
      {err && <p className="mt-1 text-sm text-danger">{err}</p>}
    </div>
  );
}

export function Checkbox({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" name={name} className="size-4 accent-primary" {...rest} /> {label}
    </label>
  );
}

export function SubmitButton({ children, variant = "primary", ...rest }: { children: React.ReactNode; variant?: "primary" | "danger" | "plain" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" disabled={pending} className={btn(variant)} {...rest}>
      {pending ? "Saving…" : children}
    </button>
  );
}


/** Submit button that asks for confirmation first (deletions). */
export function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" disabled={pending} className={btn("danger")} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {pending ? "Working…" : children}
    </button>
  );
}
