import { describe, expect, it } from "bun:test";
import { isStreamTeardownError, isYoutubeStreamError } from "./stream-fallback";

describe("isStreamTeardownError", () => {
	it("detects EPIPE and broken pipe", () => {
		expect(
			isStreamTeardownError(
				Object.assign(new Error("write EPIPE"), { code: "EPIPE" }),
			),
		).toBe(true);
		expect(isStreamTeardownError(new Error("Broken pipe"))).toBe(true);
		expect(isStreamTeardownError(new Error("premature close"))).toBe(true);
	});

	it("detects abort errors", () => {
		expect(
			isStreamTeardownError(
				Object.assign(new Error("aborted"), { name: "AbortError" }),
			),
		).toBe(true);
	});
});

describe("isYoutubeStreamError", () => {
	it("does not treat teardown errors as YouTube failures", () => {
		expect(
			isYoutubeStreamError(
				Object.assign(new Error("write EPIPE"), { code: "EPIPE" }),
			),
		).toBe(false);
	});

	it("detects real YouTube extraction failures", () => {
		expect(
			isYoutubeStreamError(new Error("Sign in to confirm you're not a bot")),
		).toBe(true);
		expect(
			isYoutubeStreamError(
				Object.assign(new Error("failed"), { stderr: "yt-dlp: ERROR" }),
			),
		).toBe(true);
	});
});
