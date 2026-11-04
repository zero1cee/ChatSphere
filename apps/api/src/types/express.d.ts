import type { SelfUser } from '@chatsphere/shared';
import type { AccessTokenPayload } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
      currentUser?: SelfUser;
    }
  }
}
