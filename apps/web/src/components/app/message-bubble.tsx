import type { MessageDTO } from '@chatsphere/shared';

import { UserAvatar } from '@/components/app/user-avatar';
import { formatMessageTime } from '@/lib/format-time';
import { cn } from '@/lib/utils';

export function MessageBubble({
  message,
  own,
  showSender,
}: {
  message: MessageDTO;
  own: boolean;
  showSender: boolean;
}) {
  const content = message.deletedAt ? null : message.content;

  return (
    <div className={cn('flex w-full gap-2.5', own ? 'justify-end' : 'justify-start')}>
      {!own ? <UserAvatar name={message.sender.name} size="sm" className="mt-5 shrink-0" /> : null}

      <div
        className={cn(
          'flex max-w-[82%] flex-col sm:max-w-[70%]',
          own ? 'items-end' : 'items-start',
        )}
        data-message-id={message.id}
      >
        {showSender && !own ? (
          <p className="mb-1 px-1 text-[0.7rem] font-medium text-muted-foreground">
            {message.sender.name}
          </p>
        ) : null}

        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
            own
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md border border-border/70 bg-card text-card-foreground',
          )}
        >
          {content ? (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <p className="italic opacity-75">Message deleted</p>
          )}
        </div>

        <time
          dateTime={message.createdAt}
          className="mt-1 px-1 text-[0.65rem] text-muted-foreground"
        >
          {formatMessageTime(message.createdAt)}
        </time>
      </div>
    </div>
  );
}
