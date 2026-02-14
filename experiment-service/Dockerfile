FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Build stage ---
FROM base AS build
WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy package manifests first for better dependency caching
COPY packages/shared/package.json packages/shared/package.json
COPY experiment-service/package.json experiment-service/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy shared package
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/src packages/shared/src

# Copy experiment-service
COPY experiment-service/tsconfig.json experiment-service/tsconfig.json
COPY experiment-service/prisma experiment-service/prisma
COPY experiment-service/src experiment-service/src

# Generate Prisma client
RUN pnpm --filter experiment-service run db:generate

# Build shared package first, then experiment-service
RUN pnpm --filter @experiments/shared run build
RUN pnpm --filter experiment-service run build

# --- Production stage ---
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./

# Copy shared package (built)
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist

# Copy experiment-service (built)
COPY --from=build /app/experiment-service/package.json experiment-service/package.json
COPY --from=build /app/experiment-service/dist experiment-service/dist
COPY --from=build /app/experiment-service/prisma experiment-service/prisma

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Generate Prisma client for production runtime
RUN pnpm dlx prisma@6.19.2 generate --schema experiment-service/prisma/schema.prisma

WORKDIR /app/experiment-service

USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
