import next from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...next,
  ...nextTs,
  { ignores: [".next/**", ".next-e2e/**", "playwright-report/**", "test-results/**", "node_modules/**", "src/generated/**", ".pgdata/**", "next-env.d.ts"] },
];

export default config;
