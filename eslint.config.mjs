// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';

import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/*.mjs', 'dist/**/*', 'coverage/**/*'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      'simple-import-sort': eslintPluginSimpleImportSort,
      'unused-imports': eslintPluginUnusedImports,
    },
    rules: {
      // Import hygiene
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // Type safety
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'off', // replaced by unused-imports plugin
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',

      // Code quality
      eqeqeq: ['error', 'always'],

      // Intentionally off for this CLI app — console is used for structured logging
      'no-console': 'off',

      // Off: unnecessary constraint for an infrastructure-boundary codebase
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-unused-expressions': 'off',

      // Off: API response boundaries require type assertions (response.json() returns any)
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-unsafe-optional-chaining': 'off',

      curly: 'off',
    },
  },
);
