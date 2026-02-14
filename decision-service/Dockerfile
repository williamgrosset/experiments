FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Build stage ---
FROM base AS build
WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy package manifests first for better dependency caching
COPY packages/shared/package.json packages/shared/package.json
COPY decision-service/package.json decision-service/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy shared package
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/src packages/shared/src

# Copy decision-service
COPY decision-service/tsconfig.json decision-service/tsconfig.json
COPY decision-service/src decision-service/src

# Build shared package first, then decision-service
RUN pnpm --filter @experiments/shared run build
RUN pnpm --filter decision-service run build

# --- Production stage ---
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./

# Copy shared package (built)
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist

# Copy decision-service (built)
COPY --from=build /app/decision-service/package.json decision-service/package.json
COPY --from=build /app/decision-service/dist decision-service/dist

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/decision-service

USER node
EXPOSE 3002
CMD ["node", "dist/index.js"]
