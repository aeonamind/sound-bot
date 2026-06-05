import { join } from "node:path";
import ejs from "ejs";
import type { BotConfig } from "./config";

const viewsDir = join(import.meta.dir, "..", "public");

export function startServer(config: BotConfig) {
	return Bun.serve({
		port: Number(process.env.PORT ?? 3000),
		async fetch(req) {
			const url = new URL(req.url);

			if (url.pathname === "/" && req.method === "GET") {
				const html = await ejs.renderFile(join(viewsDir, "index.ejs"), {
					clientId: config.clientId,
				});

				return new Response(html, {
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			}

			return new Response("Not Found", { status: 404 });
		},
	});
}
