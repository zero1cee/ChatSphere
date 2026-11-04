'use client';

import type { ConversationData, PublicUser } from '@chatsphere/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { UserAvatar } from '@/components/app/user-avatar';
import { UserSearch } from '@/components/app/user-search';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createConversation } from '@/features/conversations/api';
import { conversationKeys } from '@/features/conversations/queries';
import { ApiError } from '@/lib/api-client';

export function NewConversationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [title, setTitle] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMode('direct');
      setTitle('');
      setSelectedUsers([]);
      setError(null);
    }
  }, [open]);

  const finish = (data: ConversationData) => {
    queryClient.setQueryData(conversationKeys.detail(data.conversation.id), data);
    void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    onOpenChange(false);
    router.push(`/chats/${data.conversation.id}`);
  };

  const directMutation = useMutation({
    mutationFn: (userId: string) => createConversation({ type: 'DIRECT', userId }),
    onSuccess: finish,
    onError: (mutationError) => {
      const message =
        mutationError instanceof ApiError
          ? mutationError.message
          : 'We could not start that conversation.';
      setError(message);
      toast.error(message);
    },
  });

  const groupMutation = useMutation({
    mutationFn: () =>
      createConversation({
        type: 'GROUP',
        title: title.trim(),
        memberIds: selectedUsers.map((user) => user.id),
      }),
    onSuccess: finish,
    onError: (mutationError) => {
      const message =
        mutationError instanceof ApiError
          ? mutationError.message
          : 'We could not create that group.';
      setError(message);
      toast.error(message);
    },
  });

  const addUser = (user: PublicUser) => {
    if (selectedUsers.some((selected) => selected.id === user.id)) {
      return;
    }

    setSelectedUsers((current) => [...current, user].slice(0, 49));
    setError(null);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((current) => current.filter((user) => user.id !== userId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Start a direct chat or bring a few people into a group.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as 'direct' | 'group');
            setError(null);
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="direct" className="flex-1">
              Direct
            </TabsTrigger>
            <TabsTrigger value="group" className="flex-1">
              Group
            </TabsTrigger>
          </TabsList>

          {error ? (
            <p
              className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <TabsContent value="direct" className="mt-4">
            <UserSearch
              onSelect={(user) => directMutation.mutate(user.id)}
              pending={directMutation.isPending}
              autoFocus
            />
            {directMutation.isPending ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Opening conversation…
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="group" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="new-group-title">Group name</Label>
              <Input
                id="new-group-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError(null);
                }}
                placeholder="Design crew"
                maxLength={100}
                className="mt-1.5 h-10"
              />
            </div>

            {selectedUsers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 py-1 pl-1.5 pr-1 text-xs"
                  >
                    <UserAvatar name={user.name} size="sm" className="size-5 text-[0.55rem]" />
                    {user.name}
                    <button
                      type="button"
                      onClick={() => removeUser(user.id)}
                      aria-label={`Remove ${user.name}`}
                      className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <UserSearch
              key={`group-search-${selectedUsers.length}`}
              onSelect={addUser}
              selectedIds={selectedUsers.map((user) => user.id)}
              pending={groupMutation.isPending}
              placeholder="Add people to the group"
            />

            <div className="flex items-center justify-between border-t border-border/70 pt-4">
              <p className="text-xs text-muted-foreground">
                {selectedUsers.length} selected · max 49
              </p>
              <Button
                type="button"
                onClick={() => groupMutation.mutate()}
                disabled={
                  groupMutation.isPending || title.trim().length === 0 || selectedUsers.length === 0
                }
                className="rounded-xl"
              >
                {groupMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                Create group
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
