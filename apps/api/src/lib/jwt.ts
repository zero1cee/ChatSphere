import { jwtVerify, SignJWT } from 'jose';

import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = 'chatsphere-api';
const AUDIENCE = 'chatsphere-web';

export interface AccessTokenPayload {
  userId: string;
  sessionId: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ sid: payload.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.ACCESS_TOKEN_TTL_SECONDS)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'],
  });

  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new Error('Access token is missing required claims.');
  }

  return {
    userId: payload.sub,
    sessionId: payload.sid,
  };
}
