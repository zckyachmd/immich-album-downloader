# ---- Base image ----
FROM node:20-alpine AS base

# ---- App directory ----
WORKDIR /app

# ---- Dependencies stage ----
FROM base AS dependencies

# Copy package files first (better caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev

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
