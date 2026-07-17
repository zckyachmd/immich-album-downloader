FROM oven/bun:alpine AS dependencies

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:alpine AS production

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN mkdir -p /downloads

ENV DEFAULT_OUTPUT=/downloads \
    NODE_ENV=production

ENTRYPOINT ["bun", "src/main.ts"]
CMD []
