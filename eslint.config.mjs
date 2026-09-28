import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      'miniprogram_dist/',
      'coverage/',
      '.worktrees/',
      '.superpowers/',
      'example/miniprogram/miniprogram_npm/',
      'node_modules/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'navigator',
        'fetch',
        'URL',
        'URLSearchParams',
        'TextEncoder',
        'TextDecoder',
        'XMLHttpRequest',
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['example/**/*.ts'],
    languageOptions: {
      globals: {
        wx: 'readonly',
        App: 'readonly',
        Page: 'readonly',
        getApp: 'readonly',
        Component: 'readonly',
      },
    },
  },
  prettier,
);
