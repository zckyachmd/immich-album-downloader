FROM oven/bun:1.2.21-alpine AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.2.21-alpine AS runtime

WORKDIR /app

ENV DEFAULT_OUTPUT=/downloads \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY src ./src

RUN addgroup -S app && \
    adduser -S app -G app && \
    mkdir -p /downloads /app/media-cache && \
    chown -R app:app /app /downloads

USER app

ENTRYPOINT ["bun", "src/main.ts"]
CMD []
