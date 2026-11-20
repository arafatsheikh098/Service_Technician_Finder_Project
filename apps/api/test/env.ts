// Loaded before every test file (and before any app module reads process.env).
process.env.NODE_ENV = 'test';
// Always the dedicated test database, never whatever DATABASE_URL the shell has.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://techfinder:techfinder@localhost:5432/techfinder_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-0123456789';
process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret-0123456789';
process.env.NOTIFICATIONS_DRIVER = 'log';
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.ANTHROPIC_API_KEY = '';
process.env.UPLOAD_DIR = 'test/.uploads';
