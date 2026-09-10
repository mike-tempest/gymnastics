import 'reflect-metadata';
import { validate } from './env.validation';

const required = {
  NODE_ENV: 'production',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'test',
  DB_PASSWORD: 'test',
  DB_DATABASE: 'tumblebase_test',
  JWT_SECRET: 'a-test-only-secret-with-at-least-32-characters',
};

describe('Resend deployment environment', () => {
  it('boots with Resend settings without obsolete SMTP host and port', () => {
    const config = validate({
      ...required,
      RESEND_API_KEY: 're_test_placeholder',
      EMAIL_FROM: 'Tumblebase <noreply@mail.tumblebase.com>',
    });
    expect(config.RESEND_API_KEY).toBe('re_test_placeholder');
    expect(config.EMAIL_HOST).toBeUndefined();
    expect(config.EMAIL_PORT).toBeUndefined();
  });

  it('still permits local development without sending email', () => {
    expect(() => validate({ ...required, NODE_ENV: 'development' })).not.toThrow();
  });

  it('still rejects missing database settings and weak signing secrets', () => {
    expect(() => validate({ ...required, DB_HOST: undefined })).toThrow('DB_HOST');
    expect(() => validate({ ...required, JWT_SECRET: 'too-short' })).toThrow('JWT_SECRET');
  });
});
