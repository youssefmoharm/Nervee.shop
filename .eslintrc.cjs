module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'react/jsx-no-target-blank': ['error', { allowReferrer: false, enforceDynamicLinks: 'always' }],
    'jsx-a11y/label-has-associated-control': ['error', { required: { some: ['nesting', 'id'] } }],
    'react/prop-types': 'off',
  },
  overrides: [
    {
      // Horizontal scroll regions need keyboard focus (verified by axe on mobile).
      files: ['src/components/SizeChartTable.tsx', 'src/pages/Checkout.tsx'],
      rules: {
        'jsx-a11y/no-noninteractive-tabindex': [
          'error',
          { roles: ['tabpanel', 'region'], allowExpressionValues: true },
        ],
      },
    },
    {
      // Vitest (not Jest) powers unit tests; globals are enabled in vite.config.
      files: ['tests/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
      env: {
        node: true,
      },
    },
  ],
};
