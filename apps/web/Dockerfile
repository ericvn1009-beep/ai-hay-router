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

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV AIHAY_API_URL=http://api:3000

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/
RUN pnpm install --filter @aihay/web... --prod --ignore-scripts \
  || pnpm install --filter @aihay/web... --ignore-scripts

COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.ts ./apps/web/next.config.ts
COPY --from=build /app/apps/web/package.json ./apps/web/package.json

WORKDIR /app/apps/web
EXPOSE 3001
CMD ["pnpm", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3001"]
