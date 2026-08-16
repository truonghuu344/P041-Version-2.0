const path = require('path');

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'babel-jest',
      { configFile: path.resolve(__dirname, 'babel.config.jest.js') },
    ],
  },
  moduleNameMapper: {
    // CSS modules
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    // Path aliases
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)', '**/*.test.(ts|tsx)'],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/__tests__/**',
    '!**/*.d.ts',
  ],
};

module.exports = config;
