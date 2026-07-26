import { afterEach, describe, expect, it } from "vitest";
import { jitsiRoomUrl } from "./jitsi";

const original = process.env.JITSI_BASE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.JITSI_BASE_URL;
  else process.env.JITSI_BASE_URL = original;
});

describe("jitsiRoomUrl", () => {
  it("defaults to public meet.jit.si with a per-booking room", () => {
    delete process.env.JITSI_BASE_URL;
    expect(jitsiRoomUrl("abc-123")).toBe("https://meet.jit.si/DayOtter-abc-123");
  });

  it("uses a self-hosted base and strips trailing slashes", () => {
    process.env.JITSI_BASE_URL = "https://meet.acme.com/";
    expect(jitsiRoomUrl("uid9")).toBe("https://meet.acme.com/DayOtter-uid9");
  });
});
