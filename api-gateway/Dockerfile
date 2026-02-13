FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Build stage ---
FROM base AS build
WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./

# Copy api-gateway
COPY api-gateway/package.json api-gateway/
COPY api-gateway/tsconfig.json api-gateway/
COPY api-gateway/src api-gateway/src

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Build
RUN pnpm --filter api-gateway run build

# --- Production stage ---
FROM base AS production
WORKDIR /app

COPY --from=build /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml* ./

# Copy api-gateway (built)
COPY --from=build /app/api-gateway/package.json api-gateway/
COPY --from=build /app/api-gateway/dist api-gateway/dist

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

WORKDIR /app/api-gateway

EXPOSE 3000
CMD ["node", "dist/index.js"]
