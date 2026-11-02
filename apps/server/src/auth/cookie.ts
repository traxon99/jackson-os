import { deleteCookie, getCookie, setCookie, type Context } from 'hono/cookie';

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const CHALLENGE_MAX_AGE = 5 * 60;

export const SESSION_COOKIE_NAME = '__Host-session';
export const CHALLENGE_COOKIE_NAME = '__Host-chal';

export function setSessionCookie(
  c: Context,
  token: string,
  options?: { maxAgeSec?: number },
): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: options?.maxAgeSec ?? SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
  });
}

export function readSessionToken(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}

export function setChallengeCookie(c: Context, challengeId: string): void {
  setCookie(c, CHALLENGE_COOKIE_NAME, challengeId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: CHALLENGE_MAX_AGE,
  });
}

export function readChallengeId(c: Context): string | undefined {
  return getCookie(c, CHALLENGE_COOKIE_NAME);
}

export function clearChallengeCookie(c: Context): void {
  deleteCookie(c, CHALLENGE_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
  });
}
