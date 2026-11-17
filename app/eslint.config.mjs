import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@next/next/no-img-element': 'off', // 非公開Storageの期限付きURLを表示するため <img> を使用
    },
  },
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts', 'tests/**', 'public/sw.js']),
]);
