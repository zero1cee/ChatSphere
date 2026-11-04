'use client';

import type { PublicUser } from '@chatsphere/shared';
import { Loader2, Search } from 'lucide-react';
import { useState } from 'react';

import { UserAvatar } from '@/components/app/user-avatar';
import { Input } from '@/components/ui/input';
import { useUserSearch } from '@/features/conversations/queries';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

export function UserSearch({
  onSelect,
  selectedIds = [],
  pending = false,
  placeholder = 'Search by name or username',
  autoFocus = false,
}: {
  onSelect: (user: PublicUser) => void;
  selectedIds?: string[];
  pending?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const { data, isFetching, isError } = useUserSearch(debouncedQuery);
  const selected = new Set(selectedIds);
  const results = (data ?? []).filter((user) => !selected.has(user.id));
  const canSearch = debouncedQuery.trim().length >= 2;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="h-10 pl-9"
          aria-label="Search people"
          autoFocus={autoFocus}
        />
      </div>

      {!canSearch ? (
        <p className="px-1 text-xs text-muted-foreground">
          Type at least 2 characters to search for people.
        </p>
      ) : isFetching ? (
        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Searching…
        </p>
      ) : isError ? (
        <p className="px-1 text-xs text-destructive" role="alert">
          We could not search for people. Try again.
        </p>
      ) : results.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          No people found for “{debouncedQuery.trim()}”.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => onSelect(user)}
                disabled={pending}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserAvatar name={user.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{user.username}
                  </span>
                </span>
                {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
