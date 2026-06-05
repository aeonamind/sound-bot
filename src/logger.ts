export function createLogger(context: string) {
	const prefix = `[${context}]`;

	return {
		log: (message: string, ...args: unknown[]) =>
			console.log(prefix, message, ...args),
		warn: (message: string, ...args: unknown[]) =>
			console.warn(prefix, message, ...args),
		error: (message: string, ...args: unknown[]) =>
			console.error(prefix, message, ...args),
		debug: (message: string, ...args: unknown[]) =>
			console.debug(prefix, message, ...args),
	};
}
