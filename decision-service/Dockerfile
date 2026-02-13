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

# Copy decision-service
COPY decision-service/package.json decision-service/
COPY decision-service/tsconfig.json decision-service/
COPY decision-service/src decision-service/src

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Build shared package first, then decision-service
RUN pnpm --filter @experiments/shared run build
RUN pnpm --filter decision-service run build

# --- Production stage ---
FROM base AS production
WORKDIR /app

COPY --from=build /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml* ./

# Copy shared package (built)
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist

# Copy decision-service (built)
COPY --from=build /app/decision-service/package.json decision-service/
COPY --from=build /app/decision-service/dist decision-service/dist

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

WORKDIR /app/decision-service

EXPOSE 3002
CMD ["node", "dist/index.js"]
