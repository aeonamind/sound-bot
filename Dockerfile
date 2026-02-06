FROM node:22 AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY ./src ./src
COPY ./tsconfig.build.json ./tsconfig.build.json
COPY ./tsconfig.json ./tsconfig.json
COPY ./nest-cli.json ./nest-cli.json

RUN yarn build

FROM node:22 AS node_modules

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/yarn.lock ./

RUN yarn install --frozen-lockfile --only=production

FROM node:22-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=node_modules /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "dist/main"]

