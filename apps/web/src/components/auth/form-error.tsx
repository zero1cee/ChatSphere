import { AlertCircle } from 'lucide-react';

export function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1.5 text-xs text-destructive" role="alert">
      {message}
    </p>
  );
}
