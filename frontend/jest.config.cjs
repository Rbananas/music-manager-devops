module.exports = {
  rootDir: '.',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.test.jsx'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { configFile: require.resolve('./babel.config.cjs') }] },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  clearMocks: true
};
