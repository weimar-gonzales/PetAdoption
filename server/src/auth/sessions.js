import crypto from 'node:crypto';
import { config } from '../config.js';

export const createSessionToken = () => crypto.randomBytes(32).toString('base64url');

export const hashSessionToken = (token, secret = config.sessionSecret) => crypto
  .createHmac('sha256', secret)
  .update(token)
  .digest('hex');

export const sessionCookie = (token, { maxAge = config.sessionMaxAge, secure = config.secureCookies } = {}) => {
  const attributes = [
    `${config.sessionCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAge / 1000)}`,
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
};

export const clearSessionCookie = () => `${config.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.secureCookies ? '; Secure' : ''}`;

export const parseSessionCookie = (header) => {
  if (!header) return null;
  const prefix = `${config.sessionCookieName}=`;
  const value = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
};
