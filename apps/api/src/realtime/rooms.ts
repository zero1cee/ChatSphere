export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}
