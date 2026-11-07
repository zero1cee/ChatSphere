import type { ApiSuccess, MessageAttachmentDTO } from '@chatsphere/shared';

import { API_BASE_URL, ApiError, refreshSession } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;
export const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
]);

export async function uploadAttachment(file: File): Promise<MessageAttachmentDTO> {
  const send = async (): Promise<Response> => {
    const accessToken = useAuthStore.getState().accessToken;
    const body = new FormData();
    body.append('file', file);

    return fetch(`${API_BASE_URL}/api/attachments`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body,
    });
  };

  let response = await send();

  if (response.status === 401) {
    const session = await refreshSession();

    if (session) {
      response = await send();
    }
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccess<{ attachment: MessageAttachmentDTO }>
    | { error?: { code?: string; message?: string; details?: unknown } }
    | null;

  if (!response.ok) {
    const error = payload as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    throw new ApiError(
      response.status,
      error?.error?.code ?? 'UPLOAD_FAILED',
      error?.error?.message ?? 'The file could not be uploaded.',
      error?.error?.details,
    );
  }

  return (payload as ApiSuccess<{ attachment: MessageAttachmentDTO }>).data.attachment;
}
