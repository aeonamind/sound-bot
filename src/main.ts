import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);

	// Configure EJS template engine
	app.setBaseViewsDir(join(__dirname, "..", "views"));
	app.setViewEngine("ejs");

	await app.listen(3000);
}
bootstrap();
