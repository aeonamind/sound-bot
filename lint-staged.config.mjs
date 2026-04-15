/** Staged-file tsc ignores tsconfig, breaks paths/decorators/skipLibCheck — typecheck the whole project once. */
export default {
	"*.{js,ts,json}": "biome check --write --no-errors-on-unmatched",
	"**/*.{ts,tsx}": () => "tsc --noEmit -p tsconfig.json",
};
