module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  overrides: [
    {
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  ],
  rules: {
    'max-len': ['warn', { code: 120 }],
    'comma-dangle': ['warn', 'always-multiline'],
    'semi': ['warn', 'always'],
    'indent': ['warn', 2],
    'import/order': ['warn', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
      ],
      'newlines-between': 'always',
    }],
    '@typescript-eslint/no-unused-vars': ['warn', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_',
    }],
    '@typescript-eslint/no-empty-interface': 'error',
    '@typescript-eslint/no-empty-function': 'error',
    '@typescript-eslint/ban-ts-comment': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  env: {
    node: true,
    es6: true,
  },
};