import { Check, Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

const securityPoints = [
  'Argon2id password hashing and rotating refresh sessions',
  'Server-side authorisation on every conversation, message, and room',
  'Private attachments delivered through short-lived signed URLs',
  'Shared Zod schemas validate every REST body and socket payload',
];

export function SecuritySection() {
  return (
    <section id="security" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-border/80 bg-card">
        <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[0.95fr_1.05fr] lg:p-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-presence-online/30 bg-presence-online/10 px-3 py-1 text-xs font-medium text-foreground">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Security is part of the product
            </span>
            <h2 className="mt-5 font-display text-4xl tracking-[-0.02em] text-balance sm:text-5xl">
              Trust is a feature, not a settings page.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              The browser never decides who can read a conversation. Authentication, membership, and
              ownership checks live in the API — and the UI is designed around those rules.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
                <Fingerprint className="size-3.5" aria-hidden="true" /> Session rotation
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
                <LockKeyhole className="size-3.5" aria-hidden="true" /> Private files
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
                <KeyRound className="size-3.5" aria-hidden="true" /> Server-side authz
              </span>
            </div>
          </div>

          <ul className="grid content-center gap-3">
            {securityPoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/60 p-4 text-sm leading-relaxed"
              >
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-presence-online/15 text-presence-online">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
