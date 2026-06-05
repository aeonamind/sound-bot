# sound-bot

A Discord music bot built with [Bun](https://bun.sh/) and [discord.js](https://discord.js.org/).

## Project structure

```
├── public/          # Static assets (landing page)
├── src/
│   ├── index.ts     # Entry point
│   ├── config.ts    # Environment configuration
│   ├── logger.ts    # Logging utility
│   ├── server.ts    # HTTP server
│   ├── bot/         # Discord bot
│   │   ├── client.ts
│   │   ├── service.ts
│   │   ├── commands/
│   │   ├── events/
│   │   └── extractors/
│   └── types/       # Ambient type declarations
├── package.json
├── tsconfig.json
└── bun.lock
```

## Prerequisites

- [Bun](https://bun.sh/docs/installation) >= 1.0.0

## Installation

```bash
bun install
```

Create a `.env` file with your Discord bot credentials (`BOT_TOKEN`, `CLIENT_ID`, etc.).

## Running

```bash
bun run dev      # development with hot reload
bun run start    # production
```

The landing page is served at `http://localhost:3000`.

## Scripts

```bash
bun run test       # run tests
bun run typecheck  # type check
bun run lint       # lint and format
```

## License

UNLICENSED
