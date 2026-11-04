'use client';

import type {
  ConversationDTO,
  ConversationMemberDTO,
  MemberRole,
  PublicUser,
} from '@chatsphere/shared';
import { MAX_GROUP_MEMBERS } from '@chatsphere/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, Loader2, LogOut, Shield, UserMinus, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { UserAvatar } from '@/components/app/user-avatar';
import { UserSearch } from '@/components/app/user-search';
import { Badge } from '@/components/ui/badge';
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
import {
  addConversationMembers,
  deleteConversation,
  removeConversationMember,
  updateConversation,
  updateMemberRole,
} from '@/features/conversations/api';
import { conversationKeys } from '@/features/conversations/queries';
import { ApiError } from '@/lib/api-client';
import { canManageGroup, getMemberRole, getOtherMember } from '@/lib/conversation';

const roleLabel: Record<MemberRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
};

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

export function ConversationDetailsDialog({
  conversation,
  currentUserId,
  open,
  onOpenChange,
}: {
  conversation: ConversationDTO;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(conversation.title ?? '');
  const detailKey = conversationKeys.detail(conversation.id);
  const isGroup = conversation.type === 'GROUP';
  const myRole = getMemberRole(conversation, currentUserId);
  const isOwner = myRole === 'OWNER';
  const canManage = canManageGroup(myRole);
  const other = isGroup ? null : getOtherMember(conversation, currentUserId);
  const atMemberLimit = conversation.members.length >= MAX_GROUP_MEMBERS;

  useEffect(() => {
    setTitle(conversation.title ?? '');
  }, [conversation.title]);

  const updateCache = (data: { conversation: ConversationDTO }) => {
    queryClient.setQueryData(detailKey, data);
    void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
  };

  const leaveOrDeleteSuccess = () => {
    queryClient.removeQueries({ queryKey: detailKey });
    void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    onOpenChange(false);
    router.replace('/chats');
  };

  const renameMutation = useMutation({
    mutationFn: (nextTitle: string) => updateConversation(conversation.id, { title: nextTitle }),
    onSuccess: (data) => {
      updateCache(data);
      toast.success('Group name updated.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addMutation = useMutation({
    mutationFn: (user: PublicUser) =>
      addConversationMembers(conversation.id, { userIds: [user.id] }),
    onSuccess: (data) => {
      updateCache(data);
      toast.success('Member added.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: MemberRole }) =>
      updateMemberRole(conversation.id, memberId, { role }),
    onSuccess: (data) => {
      updateCache(data);
      toast.success('Member role updated.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeConversationMember(conversation.id, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success('Member removed.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const leaveMutation = useMutation({
    mutationFn: () => removeConversationMember(conversation.id, currentUserId),
    onSuccess: () => {
      leaveOrDeleteSuccess();
      toast.success('You left the group.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteConversation(conversation.id),
    onSuccess: () => {
      leaveOrDeleteSuccess();
      toast.success(isGroup ? 'Group deleted.' : 'Conversation hidden.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const changeRole = (member: ConversationMemberDTO, role: MemberRole) => {
    if (role === 'OWNER') {
      const confirmed = window.confirm(
        `Make ${member.user.name} the owner? You will become an admin.`,
      );
      if (!confirmed) {
        return;
      }
    }

    roleMutation.mutate({ memberId: member.userId, role });
  };

  const removeMember = (member: ConversationMemberDTO) => {
    const confirmed = window.confirm(`Remove ${member.user.name} from this group?`);
    if (!confirmed) {
      return;
    }

    removeMutation.mutate(member.userId);
  };

  const hideDirect = () => {
    const confirmed = window.confirm(
      'Hide this conversation? It will remain visible for the other person.',
    );
    if (!confirmed) {
      return;
    }

    deleteMutation.mutate();
  };

  const deleteGroup = () => {
    const confirmed = window.confirm('Delete this group for everyone? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    deleteMutation.mutate();
  };

  const leaveGroup = () => {
    const confirmed = window.confirm('Leave this group?');
    if (!confirmed) {
      return;
    }

    leaveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isGroup ? 'Group details' : 'Conversation details'}</DialogTitle>
          <DialogDescription>
            {isGroup
              ? 'Manage the group name, members, and roles.'
              : 'The person on the other side of this conversation.'}
          </DialogDescription>
        </DialogHeader>

        {isGroup ? (
          <div className="space-y-6 text-left">
            <div>
              <Label htmlFor="group-title">Group name</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="group-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={100}
                  disabled={!canManage}
                  className="h-10"
                />
                {canManage ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      renameMutation.isPending ||
                      title.trim().length === 0 ||
                      title.trim() === conversation.title
                    }
                    onClick={() => renameMutation.mutate(title.trim())}
                  >
                    {renameMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    Save
                  </Button>
                ) : null}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Members{' '}
                  <span className="text-muted-foreground">({conversation.members.length})</span>
                </h3>
                <span className="text-[0.65rem] text-muted-foreground">
                  {MAX_GROUP_MEMBERS} max
                </span>
              </div>

              <ul className="mt-3 divide-y divide-border/70 rounded-xl border border-border/70">
                {conversation.members.map((member) => {
                  const isSelf = member.userId === currentUserId;
                  const showActions =
                    !isSelf &&
                    member.role !== 'OWNER' &&
                    (isOwner || (myRole === 'ADMIN' && member.role === 'MEMBER'));

                  return (
                    <li key={member.id} className="flex flex-wrap items-center gap-3 p-3">
                      <UserAvatar name={member.user.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {member.user.name}
                          {isSelf ? (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (you)
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{member.user.username}
                        </p>
                      </div>
                      <Badge variant={member.role === 'OWNER' ? 'default' : 'outline'}>
                        {member.role === 'OWNER' ? (
                          <Crown className="size-3" aria-hidden="true" />
                        ) : member.role === 'ADMIN' ? (
                          <Shield className="size-3" aria-hidden="true" />
                        ) : null}
                        {roleLabel[member.role]}
                      </Badge>

                      {showActions ? (
                        <div className="flex w-full basis-full flex-wrap items-center justify-end gap-1 border-t border-border/40 pt-2">
                          {isOwner ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                disabled={roleMutation.isPending}
                                onClick={() =>
                                  changeRole(member, member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN')
                                }
                              >
                                {member.role === 'ADMIN' ? 'Make member' : 'Make admin'}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                disabled={roleMutation.isPending}
                                onClick={() => changeRole(member, 'OWNER')}
                              >
                                <Crown className="size-3" aria-hidden="true" />
                                Make owner
                              </Button>
                            </>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="text-destructive hover:text-destructive"
                            disabled={removeMutation.isPending}
                            onClick={() => removeMember(member)}
                          >
                            <UserMinus className="size-3.5" aria-hidden="true" />
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            {canManage ? (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <UserPlus className="size-4" aria-hidden="true" />
                  Add members
                </h3>
                {atMemberLimit ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    This group has reached the {MAX_GROUP_MEMBERS}-member limit.
                  </p>
                ) : (
                  <div className="mt-3">
                    <UserSearch
                      key={`add-member-${conversation.members.length}`}
                      onSelect={(user) => addMutation.mutate(user)}
                      selectedIds={conversation.members.map((member) => member.userId)}
                      pending={addMutation.isPending}
                      placeholder="Search people to add"
                    />
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
              <p className="text-xs text-muted-foreground">
                {isOwner
                  ? 'Transfer ownership or delete the group to leave.'
                  : 'You can leave the group at any time.'}
              </p>
              {isOwner ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="rounded-xl"
                  disabled={deleteMutation.isPending}
                  onClick={deleteGroup}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Delete group
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={leaveMutation.isPending}
                  onClick={leaveGroup}
                >
                  {leaveMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <LogOut className="size-4" aria-hidden="true" />
                  )}
                  Leave group
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5 text-left">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-5 text-center">
              <UserAvatar
                name={other?.user.name ?? 'Direct message'}
                size="lg"
                className="mx-auto"
              />
              <h3 className="mt-3 text-base font-semibold">
                {other?.user.name ?? 'Direct message'}
              </h3>
              <p className="text-xs text-muted-foreground">@{other?.user.username}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {other?.user.bio || 'No bio yet.'}
              </p>
              <p className="mt-3 text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
                Joined ChatSphere{' '}
                {other
                  ? new Date(other.user.createdAt).toLocaleDateString(undefined, {
                      month: 'long',
                      year: 'numeric',
                    })
                  : ''}
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={deleteMutation.isPending}
                onClick={hideDirect}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserMinus className="size-4" aria-hidden="true" />
                )}
                Hide conversation
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
