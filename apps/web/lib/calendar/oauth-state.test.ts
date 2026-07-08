import { beforeEach, describe, expect, it } from "vitest";
import { createState, verifyState } from "./oauth-state";

const SECRET = "test-secret-at-least-32-chars-long-abc";

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
});

describe("oauth state", () => {
  it("round-trips a valid state", () => {
    const state = createState({ userId: "u1", provider: "google" }, "nonce-1");
    const payload = verifyState(state);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe("u1");
    expect(payload!.provider).toBe("google");
    expect(payload!.nonce).toBe("nonce-1");
  });

  it("rejects a tampered signature", () => {
    const state = createState({ userId: "u1", provider: "google" }, "n");
    const tampered = state.endsWith("a") ? `${state.slice(0, -1)}b` : `${state.slice(0, -1)}a`;
    expect(verifyState(tampered)).toBeNull();
  });

  it("rejects a state signed with a different secret", () => {
    const state = createState({ userId: "u1", provider: "google" }, "n");
    process.env.AUTH_SECRET = "a-totally-different-secret-value-1234";
    expect(verifyState(state)).toBeNull();
  });

  it("rejects a stale state", () => {
    const state = createState({ userId: "u1", provider: "google" }, "n");
    expect(verifyState(state, -1)).toBeNull(); // any age exceeds a negative max
  });
});
