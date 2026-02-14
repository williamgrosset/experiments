FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Build stage ---
FROM base AS build
WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy package manifest first for better dependency caching
COPY api-gateway/package.json api-gateway/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy api-gateway
COPY api-gateway/tsconfig.json api-gateway/tsconfig.json
COPY api-gateway/src api-gateway/src

# Build
RUN pnpm --filter api-gateway run build

# --- Production stage ---
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./

# Copy api-gateway (built)
COPY --from=build /app/api-gateway/package.json api-gateway/package.json
COPY --from=build /app/api-gateway/dist api-gateway/dist

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/api-gateway

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
