FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/schema/package.json packages/schema/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @rough/server...

FROM deps AS build
COPY packages/schema packages/schema
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @rough/schema build && pnpm --filter @rough/shared build && pnpm --filter @rough/server build

FROM base AS runner
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/server/node_modules /app/apps/server/node_modules
COPY --from=build /app/apps/server/dist /app/apps/server/dist
COPY --from=build /app/packages/schema/dist /app/packages/schema/dist
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
WORKDIR /app/apps/server
EXPOSE 3000 3001
CMD ["node", "dist/index.js"]
