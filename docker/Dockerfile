FROM oven/bun:1.2.21-alpine AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.2.21-alpine AS runtime

WORKDIR /app

ENV DEFAULT_OUTPUT=/downloads \
    NODE_ENV=production

RUN addgroup -S app && \
    adduser -S app -G app && \
    mkdir -p /downloads /app/data && \
    chown app:app /downloads /app/data

COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --chown=app:app package.json bun.lock tsconfig.json ./
COPY --chown=app:app src ./src

USER app

ENTRYPOINT ["bun", "src/main.ts"]
CMD []
