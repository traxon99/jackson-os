import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const CHALLENGE_MAX_AGE = 5 * 60;

const devCookies = process.env.NODE_ENV === 'development';

/** In development, `__Host-` cookies require HTTPS; use plain names on http://localhost. */
export const SESSION_COOKIE_NAME = devCookies ? 'session' : '__Host-session';
export const CHALLENGE_COOKIE_NAME = devCookies ? 'chal' : '__Host-chal';

function cookieFlags() {
  return {
    httpOnly: true,
    secure: !devCookies,
    sameSite: 'Lax' as const,
    path: '/',
  };
}

export function setSessionCookie(
  c: Context,
  token: string,
  options?: { maxAgeSec?: number },
): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    ...cookieFlags(),
    maxAge: options?.maxAgeSec ?? SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, cookieFlags());
}

export function readSessionToken(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}

export function setChallengeCookie(c: Context, challengeId: string): void {
  setCookie(c, CHALLENGE_COOKIE_NAME, challengeId, {
    ...cookieFlags(),
    maxAge: CHALLENGE_MAX_AGE,
  });
}

export function readChallengeId(c: Context): string | undefined {
  return getCookie(c, CHALLENGE_COOKIE_NAME);
}

export function clearChallengeCookie(c: Context): void {
  deleteCookie(c, CHALLENGE_COOKIE_NAME, cookieFlags());
}
