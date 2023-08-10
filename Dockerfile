FROM node:18 as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY ./src ./src
COPY ./tsconfig.build.json ./tsconfig.build.json
COPY ./tsconfig.json ./tsconfig.json

RUN yarn build

FROM node:18 as node_modules

WORKDIR /app

COPY --from=builder /app/package.json /app/yarn.lock ./

RUN yarn install --frozen-lockfile --only=production

FROM node:18

WORKDIR /app

RUN apt update && apt install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist

COPY --from=node_modules /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "dist/main"]





