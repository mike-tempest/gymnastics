import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 15000,
  setupFilesAfterEnv: ['./setup.ts'],
  testMatch: ['**/*.test.ts'],
};

export default config;
