import type { Config } from 'jest';

const config: Config = {
  // Ensure compiled output and dependencies are never picked up as test files
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],

  // Delegate test execution to each service's own Jest configuration
  projects: ['<rootDir>/services/membership'],
};

export default config;
