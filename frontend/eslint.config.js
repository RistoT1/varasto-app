// eslint.config.js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import vueTsEslintConfig from '@vue/eslint-config-typescript';
import prettierSkipFormatting from '@vue/eslint-config-prettier/skip-formatting';

// Optional:
// import tailwind from 'eslint-plugin-tailwindcss';

export default tseslint.config(
  // Base JS rules
  eslint.configs.recommended,

  // TypeScript (non type-aware)
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  // Vue
  ...vue.configs['flat/essential'],

  // Vue + TS integration
  ...vueTsEslintConfig({ extends: ['recommended'] }),

  // Prettier compatibility
  prettierSkipFormatting,

  // 🌐 Browser globals (FIXES window/setInterval errors)
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },

  // Vue-specific tweaks
  {
    files: ['**/*.vue'],
    rules: {
      'vue/block-lang': 'off',
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/require-prop-types': 'warn',
    },
  },

  // Shared rules
  {
    files: ['**/*.{ts,tsx,vue,js,jsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],

      '@typescript-eslint/no-unused-expressions': 'off',

      '@typescript-eslint/no-explicit-any': 'warn',

      // ⚠️ IMPORTANT: must be OFF (prevents crash)
      '@typescript-eslint/consistent-type-imports': 'off',

      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['warn', 'always'],
      'no-debugger': 'error',
    },
  },

  // Ignore files
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '**/*.d.ts',
      '*.config.{js,ts,mjs,cjs}',
      '*.config.*',
      'public/**',
      '.vite/**',
    ],
  }
);