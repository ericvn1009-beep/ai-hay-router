# Multi-stage build for AI Hay Router API
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV CI=true
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
# pnpm 9 is more predictable in Docker; ignore optional native script failures
RUN pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm rebuild esbuild 2>/dev/null || true

FROM deps AS build
COPY apps/api apps/api
# tsc only — no esbuild required for production build
RUN pnpm --filter @aihay/api exec tsc -p tsconfig.json \
  && mkdir -p apps/api/dist/db \
  && cp apps/api/src/db/schema.sql apps/api/dist/db/schema.sql \
  && cp apps/api/models.yaml apps/api/dist/models.yaml

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV CI=true
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @aihay/api... --ignore-scripts

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/models.yaml ./apps/api/models.yaml

WORKDIR /app/apps/api
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
