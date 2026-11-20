import { Router, type Response, type RequestHandler } from 'express';
import { z } from 'zod';
import { isProd } from '../../config/env.js';
import { parse } from '../../lib/validate.js';
import type { Deps } from '../../lib/deps.js';
import { registry, json, errors } from '../../docs/openapi.js';
import {
  AuthResponse,
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
} from './auth.schemas.js';
import { createAuthService, type IssuedTokens } from './auth.service.js';

export const REFRESH_COOKIE = 'tf_rt';
const COOKIE_PATH = '/api/v1/auth';

function setRefreshCookie(res: Response, tokens: IssuedTokens) {
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true, // not readable from JavaScript, so XSS can't steal it
    secure: isProd,
    sameSite: 'strict', // never sent on cross-site requests, which blocks CSRF on /refresh
    path: COOKIE_PATH,
    expires: tokens.refreshExpiresAt,
  });
}

export function authRouter(deps: Deps, authLimiter: RequestHandler, loginLimiter: RequestHandler) {
  const service = createAuthService(deps.notifier);
  const r = Router();

  r.post('/register', authLimiter, async (req, res) => {
    const body = parse(RegisterBody, req.body);
    const { user, tokens } = await service.register(body);
    setRefreshCookie(res, tokens);
    res.status(201).json({ accessToken: tokens.accessToken, user });
  });

  r.post('/login', authLimiter, loginLimiter, async (req, res) => {
    const { email, password } = parse(LoginBody, req.body);
    const { user, tokens } = await service.login(email, password);
    setRefreshCookie(res, tokens);
    res.json({ accessToken: tokens.accessToken, user });
  });

  r.post('/refresh', async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    try {
      const { user, tokens } = await service.refresh(token ?? '');
      setRefreshCookie(res, tokens);
      res.json({ accessToken: tokens.accessToken, user });
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
      throw err;
    }
  });

  r.post('/logout', async (req, res) => {
    await service.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    res.status(204).end();
  });

  r.post('/forgot-password', authLimiter, async (req, res) => {
    const { email } = parse(ForgotPasswordBody, req.body);
    await service.forgotPassword(email);
    res.status(202).json({ message: 'If that email is registered, a reset link is on its way.' });
  });

  r.post('/reset-password', authLimiter, async (req, res) => {
    const { token, password } = parse(ResetPasswordBody, req.body);
    await service.resetPassword(token, password);
    res.json({ message: 'Password updated. Please log in.' });
  });

  return r;
}

const tag = ['Auth'];
registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: tag,
  summary: 'Create a customer or technician account (sets refresh cookie)',
  request: { body: { content: { 'application/json': { schema: RegisterBody } } } },
  responses: { 201: json(AuthResponse, 'Created'), 400: errors[400], 409: errors[409] },
});
registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: tag,
  summary: 'Log in (sets refresh cookie)',
  request: { body: { content: { 'application/json': { schema: LoginBody } } } },
  responses: { 200: json(AuthResponse), 401: errors[401] },
});
registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: tag,
  summary: 'Rotate the refresh cookie and get a new access token',
  responses: { 200: json(AuthResponse), 401: errors[401] },
});
registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: tag,
  summary: 'Revoke this session',
  responses: { 204: { description: 'Logged out' } },
});
registry.registerPath({
  method: 'post',
  path: '/auth/forgot-password',
  tags: tag,
  summary: 'Email a password reset link',
  request: { body: { content: { 'application/json': { schema: ForgotPasswordBody } } } },
  responses: { 202: json(z.object({ message: z.string() }), 'Accepted') },
});
registry.registerPath({
  method: 'post',
  path: '/auth/reset-password',
  tags: tag,
  summary: 'Set a new password with a reset token',
  request: { body: { content: { 'application/json': { schema: ResetPasswordBody } } } },
  responses: { 200: json(z.object({ message: z.string() })), 400: errors[400] },
});
