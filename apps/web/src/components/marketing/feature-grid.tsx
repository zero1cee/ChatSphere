import {
  Files,
  type LucideIcon,
  MessageSquareText,
  Radio,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
}

const features: Feature[] = [
  {
    title: 'Real-time, without the refresh',
    description:
      'Socket.IO rooms, acknowledgements, and reconnect sync keep conversations current without turning the UI into a polling loop.',
    icon: Radio,
  },
  {
    title: 'Groups with actual structure',
    description:
      'Owners, admins, and members have clear permissions. Membership is enforced on the server for every read and write.',
    icon: UsersRound,
  },
  {
    title: 'Presence you can trust',
    description:
      'Typing indicators expire, presence accounts for multiple devices, and a short grace period absorbs flaky connections.',
    icon: MessageSquareText,
  },
  {
    title: 'Receipts that mean something',
    description:
      'Sent, delivered, and read are defined states backed by watermarks — not optimistic guesses on the client.',
    icon: ShieldCheck,
  },
  {
    title: 'Files, kept private',
    description:
      'Attachments live in object storage, never in PostgreSQL, and are accessed through short-lived signed URLs.',
    icon: Files,
  },
  {
    title: 'Search that stays scoped',
    description:
      'Find messages inside a conversation you belong to. Search never reaches across a permission boundary.',
    icon: Search,
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          What&apos;s inside
        </p>
        <h2 className="mt-3 font-display text-4xl tracking-[-0.02em] text-balance sm:text-5xl">
          The essentials, built properly.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          No feature is here because a chat app is expected to have it. Each one exists to make a
          real conversation work — and each one has a server-side rule behind it.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              className="group rounded-2xl border border-border/80 bg-card p-5 transition-colors hover:border-primary/30 hover:bg-surface-raised"
            >
              <span className="grid size-10 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-[0.95rem] font-semibold tracking-[-0.01em]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
