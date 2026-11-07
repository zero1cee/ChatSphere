import { getInitials } from '@/lib/conversation';
import { cn } from '@/lib/utils';

const sizeClasses = {
  sm: 'size-8 text-[0.65rem]',
  md: 'size-10 text-xs',
  lg: 'size-12 text-sm',
} as const;

export function UserAvatar({
  name,
  size = 'md',
  className,
  online,
}: {
  name: string;
  size?: keyof typeof sizeClasses;
  className?: string;
  online?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary',
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(name) || '?'}
      {typeof online === 'boolean' ? (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background',
            online ? 'bg-presence-online' : 'bg-muted-foreground/35',
          )}
        />
      ) : null}
    </span>
  );
}
