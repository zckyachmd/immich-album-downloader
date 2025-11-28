# ---- Base image ----
FROM node:20-alpine

# ---- App directory ----
WORKDIR /app

# ---- Copy package files first (better caching) ----
COPY package.json package-lock.json ./

# ---- Install dependencies ----
RUN npm install --production

# ---- Copy source code ----
COPY . .

# ---- Create default output folder ----
RUN mkdir -p /downloads

# ---- Environment values (optional defaults) ----
ENV DEFAULT_OUTPUT=/downloads

# ---- Entry point ----
ENTRYPOINT ["node", "main.js"]
CMD []
