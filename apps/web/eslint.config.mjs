import nextConfig from 'eslint-config-next';

const config = [
  ...nextConfig,
  {
    rules: {
      '@next/next/no-img-element': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'public/sw.js'],
  },
];

export default config;
