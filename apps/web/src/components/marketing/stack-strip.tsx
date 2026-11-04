const stack = [
  'Next.js 16',
  'React 19',
  'TypeScript 5.9',
  'Tailwind CSS 4',
  'Express 5',
  'Socket.IO 4.8',
  'PostgreSQL 18',
  'Prisma 7',
  'Redis 8',
];

export function StackStrip() {
  return (
    <section id="stack" className="scroll-mt-20 border-y border-border/70 bg-canvas/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              The stack behind the sphere
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-[-0.02em] sm:text-4xl">
              Boring where it counts. Thoughtful where it shows.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            PostgreSQL is the source of truth. Redis joins in the scale phase for shared presence
            and cross-instance Socket.IO delivery.
          </p>
        </div>

        <ul className="mt-8 flex flex-wrap gap-2.5">
          {stack.map((item) => (
            <li
              key={item}
              className="rounded-full border border-border/80 bg-background/70 px-3.5 py-1.5 font-mono text-[0.7rem] text-muted-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
