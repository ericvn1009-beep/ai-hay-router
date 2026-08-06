FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/
RUN pnpm install --filter @aihay/web... --ignore-scripts

FROM deps AS build
COPY apps/web apps/web
RUN pnpm --filter @aihay/web build

# Standalone server — no next.config.ts / TypeScript needed at runtime
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV AIHAY_API_URL=http://api:3000
ENV NEXT_TELEMETRY_DISABLED=1

# Monorepo standalone layout: .next/standalone contains apps/web/server.js
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web
EXPOSE 3001
CMD ["node", "server.js"]
