FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/schema/package.json packages/schema/
COPY packages/shared/package.json packages/shared/
COPY packages/document/package.json packages/document/
COPY packages/editor/package.json packages/editor/
COPY packages/export/package.json packages/export/
COPY packages/wireframe-kit/package.json packages/wireframe-kit/
RUN pnpm install --frozen-lockfile --filter @rough/web...

FROM deps AS build
COPY packages packages
COPY apps/web apps/web
ARG VITE_API_URL=http://localhost:3000
ARG VITE_COLLAB_URL=ws://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_COLLAB_URL=$VITE_COLLAB_URL
RUN pnpm --filter @rough/schema build \
  && pnpm --filter @rough/shared build \
  && pnpm --filter @rough/document build \
  && pnpm --filter @rough/export build \
  && pnpm --filter @rough/wireframe-kit build \
  && pnpm --filter @rough/editor build \
  && pnpm --filter @rough/web build

FROM base AS runner
RUN npm install -g serve
COPY --from=build /app/apps/web/dist /app/dist
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
