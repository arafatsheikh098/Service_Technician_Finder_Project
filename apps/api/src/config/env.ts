import { z } from 'zod';

/**
 * All configuration comes from environment variables and is validated once at
 * startup. A missing or malformed value stops the process immediately instead of
 * failing later on the first request that needs it.
 */
// "true" / "false"; empty or unset means "use the default".
const bool = z
  .preprocess((v) => (v === '' ? undefined : v), z.enum(['true', 'false']).optional())
  .transform((v) => (v === undefined ? undefined : v === 'true'));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  APP_URL: z.url().default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // "queue" sends notifications through BullMQ/Redis; "log" only writes them to the log (tests and local development).
  NOTIFICATIONS_DRIVER: z.enum(['queue', 'log']).default('queue'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('TechFinder <no-reply@techfinder.local>'),

  UPLOAD_DIR: z.string().default('uploads'),

  PAYMENT_WEBHOOK_SECRET: z.string().min(16).default('dev-only-webhook-secret-change-me'),

  ANTHROPIC_API_KEY: z.string().optional(),
  TRIAGE_MODEL: z.string().default('claude-opus-5-5'),

  // Optional features that default to ON in development and OFF in production.
  API_DOCS_ENABLED: bool,
  MOCKPAY_ENABLED: bool,

  // Kill runaway queries instead of letting them pile up and exhaust the pool.
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10_000),

  RATE_LIMIT_DISABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // Logger is not available yet (it depends on env), so write directly.
    process.stderr.write(`Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }
  if (parsed.data.NODE_ENV === 'production') {
    const problems: string[] = [];
    const placeholder = /replace-me|change-me|dev-only|compose-demo|test-secret/i;
    if (placeholder.test(parsed.data.JWT_ACCESS_SECRET))
      problems.push('JWT_ACCESS_SECRET is a placeholder');
    if (placeholder.test(parsed.data.PAYMENT_WEBHOOK_SECRET))
      problems.push('PAYMENT_WEBHOOK_SECRET is a placeholder');
    if (parsed.data.RATE_LIMIT_DISABLED)
      problems.push('RATE_LIMIT_DISABLED must not be true in production');
    if (problems.length) {
      process.stderr.write(
        `Refusing to start in production:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`,
      );
      process.exit(1);
    }
    if (!parsed.data.APP_URL.startsWith('https://')) {
      process.stderr.write(
        'WARNING: APP_URL is not https://. Secure cookies require HTTPS in production.\n',
      );
    }
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const apiDocsEnabled = env.API_DOCS_ENABLED ?? !isProd;
export const mockPayEnabled = env.MOCKPAY_ENABLED ?? !isProd;
