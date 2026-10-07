import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['node_modules/**', '.next/**', 'next-env.d.ts', 'web_preview/**', 'visual-baseline/**'] },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-explicit-any': 'warn', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } }
);
