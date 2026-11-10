# TestDam — one container: Next.js (standalone) + migrations on start. PostgreSQL is external (FlyNode).
# Configuration is environment variables only (see .env.example). The build needs NO database.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
# openssl: Prisma's migration engine checks for it.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# 1. Dependencies (postinstall runs `prisma generate`, so the schema must be present).
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# --include=dev: FlyNode injects app variables (e.g. NODE_ENV=production) into build steps, which would
# otherwise skip the devDependencies the build needs (Tailwind, TypeScript, Prisma CLI).
RUN npm ci --include=dev --no-audit --no-fund

# 2. Build. Public pages are ISR and render on first request; nothing touches the database here.
FROM deps AS build
COPY . .
RUN npx next build

# 3. Minimal Prisma CLI just for `migrate deploy` at start (keep versions in sync with package.json).
FROM base AS migrator
WORKDIR /migrator
COPY prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
RUN npm init -y >/dev/null && npm install --no-audit --no-fund prisma@7.10.1 dotenv@17.4.2

# 4. Runtime image.
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=migrator --chown=node:node /migrator /migrator
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then start. On an empty database the app loads the area/test catalogue
# and creates the first ADMIN from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (src/instrumentation.ts).
CMD ["sh", "-c", "cd /migrator && npx prisma migrate deploy && cd /app && exec node server.js"]
