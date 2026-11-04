import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  markOnly?: boolean;
}

export function Logo({ className, markOnly = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className="size-8 shrink-0 text-primary"
      >
        <ellipse
          cx="20"
          cy="20"
          rx="16"
          ry="7.25"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          transform="rotate(-28 20 20)"
        />
        <ellipse
          cx="20"
          cy="20"
          rx="15.5"
          ry="7"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1.5"
          transform="rotate(38 20 20)"
        />
        <circle cx="20" cy="20" r="6.25" fill="currentColor" />
        <circle cx="20" cy="20" r="2.25" className="fill-primary-foreground/80" />
        <circle cx="33.4" cy="12.8" r="2" className="fill-presence-online" />
      </svg>
      {markOnly ? (
        <span className="sr-only">ChatSphere</span>
      ) : (
        <span className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
          ChatSphere
        </span>
      )}
    </span>
  );
}
