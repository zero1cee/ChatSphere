'use client';

import { Loader2, LogOut, Plus, Search, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConversationList } from '@/components/app/conversation-list';
import { NewConversationDialog } from '@/components/app/new-conversation-dialog';
import { UserAvatar } from '@/components/app/user-avatar';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConversations } from '@/features/conversations/queries';
import { logoutRequest } from '@/lib/api-client';
import {
  getConversationPreview,
  getConversationSubtitle,
  getConversationTitle,
} from '@/lib/conversation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

export function ChatsShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const conversationsQuery = useConversations();
  const [search, setSearch] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return null;
  }

  const activeConversationId = /^\/chats\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const conversationOpen = Boolean(activeConversationId);
  const normalizedSearch = search.trim().toLowerCase();
  const conversations = (conversationsQuery.data ?? []).filter((conversation) => {
    if (!normalizedSearch) {
      return true;
    }

    const haystack = [
      getConversationTitle(conversation, user.id),
      getConversationSubtitle(conversation, user.id),
      getConversationPreview(conversation, user.id),
      conversation.lastMessage?.sender.name ?? '',
      ...conversation.members.flatMap((member) => [member.user.name, member.user.username]),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  const handleSignOut = async () => {
    setSigningOut(true);

    try {
      await logoutRequest();
    } catch {
      toast.error('You have been signed out locally.');
    } finally {
      router.replace('/login');
      setSigningOut(false);
    }
  };

  return (
    <div className="flex h-svh overflow-hidden bg-canvas">
      <aside
        className={cn(
          'w-full shrink-0 flex-col border-r border-border/70 bg-background lg:flex lg:w-[21rem]',
          conversationOpen ? 'hidden lg:flex' : 'flex',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border/70 px-4">
          <Link href="/chats" aria-label="ChatSphere conversations">
            <Logo />
          </Link>
          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <Button asChild variant="ghost" size="icon" className="size-9 rounded-full">
              <Link href="/settings" aria-label="Settings">
                <Settings className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-2 p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="h-9 pl-8 pr-8 text-sm"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear conversation search"
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-start rounded-xl"
            onClick={() => setNewConversationOpen(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
            New conversation
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          <ConversationList
            conversations={conversations}
            currentUserId={user.id}
            activeConversationId={activeConversationId}
            isLoading={conversationsQuery.isLoading}
            isError={conversationsQuery.isError}
            search={search}
            onClearSearch={() => setSearch('')}
          />
        </div>

        <div className="border-t border-border/70 p-3">
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-muted"
            >
              <UserAvatar name={user.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{user.username}
                </span>
              </span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-full text-muted-foreground"
              aria-label="Sign out"
              title="Sign out"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              {signingOut ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </aside>

      <main
        className={cn(
          'min-h-0 min-w-0 flex-1 overflow-hidden',
          conversationOpen ? 'flex' : 'hidden lg:flex',
        )}
      >
        {children}
      </main>

      <NewConversationDialog open={newConversationOpen} onOpenChange={setNewConversationOpen} />
    </div>
  );
}
