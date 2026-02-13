FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Build stage ---
FROM base AS build
WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./

# Copy shared package
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src

# Copy experiment-service
COPY experiment-service/package.json experiment-service/
COPY experiment-service/tsconfig.json experiment-service/
COPY experiment-service/prisma experiment-service/prisma
COPY experiment-service/src experiment-service/src

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Generate Prisma client
RUN pnpm --filter experiment-service run db:generate

# Build shared package first, then experiment-service
RUN pnpm --filter @experiments/shared run build
RUN pnpm --filter experiment-service run build

# --- Production stage ---
FROM base AS production
WORKDIR /app

COPY --from=build /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml* ./

# Copy shared package (built)
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist

# Copy experiment-service (built)
COPY --from=build /app/experiment-service/package.json experiment-service/
COPY --from=build /app/experiment-service/dist experiment-service/dist
COPY --from=build /app/experiment-service/prisma experiment-service/prisma

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# Copy generated Prisma client from build stage
COPY --from=build /app/experiment-service/node_modules/.prisma experiment-service/node_modules/.prisma

WORKDIR /app/experiment-service

EXPOSE 3001
CMD ["node", "dist/index.js"]
