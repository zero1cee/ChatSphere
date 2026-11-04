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
}: {
  name: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary',
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(name) || '?'}
    </span>
  );
}
