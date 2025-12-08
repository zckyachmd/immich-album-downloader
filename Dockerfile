# ---- Base image ----
FROM node:20-alpine AS base

# ---- Install pnpm globally ----
RUN corepack enable && corepack prepare pnpm@latest --activate

# ---- App directory ----
WORKDIR /app

# ---- Dependencies stage ----
FROM base AS dependencies

# Copy package files first (better caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# ---- Production stage ----
FROM base AS production

# Copy dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Create default output folder
RUN mkdir -p /downloads

# Environment values (optional defaults)
ENV DEFAULT_OUTPUT=/downloads \
    NODE_ENV=production

# Entry point
ENTRYPOINT ["node", "main.js"]
CMD []
