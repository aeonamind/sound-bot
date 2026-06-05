FROM oven/bun:1 AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./

ENV HUSKY=0

RUN bun install --frozen-lockfile --production

FROM oven/bun:1-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
        -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV YT_DLP_PATH=/usr/local/bin/yt-dlp
ENV YT_DLP_COOKIES_FILE=/secrets/youtube-cookies.txt

RUN mkdir -p /secrets

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY src ./src
COPY public ./public
COPY tsconfig.json ./

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
