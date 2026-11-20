import { lookup } from "node:dns/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SsrfError, isPrivateIp, resolvePublicIp } from "./ssrf";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
const mockLookup = vi.mocked(lookup);

describe("isPrivateIp", () => {
  it("blocks loopback / private / link-local / CGNAT / metadata", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "100.64.0.1", // CGNAT
      "169.254.169.254", // cloud metadata - the one that matters most
      "0.0.0.0",
      "224.0.0.1", // multicast
      "::1",
      "fc00::1",
      "fd12::1",
      "fe80::1",
      "::ffff:10.0.0.1", // IPv4-mapped private
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows real public addresses", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "172.15.0.1", "100.63.0.1", "2606:4700:4700::1111"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

describe("resolvePublicIp", () => {
  beforeEach(() => mockLookup.mockReset());

  it("returns the pinned address when every A/AAAA record is public", async () => {
    mockLookup.mockResolvedValue([{ address: "203.0.113.5", family: 4 }] as never);
    await expect(resolvePublicIp("caldav.example.com")).resolves.toEqual({
      address: "203.0.113.5",
      family: 4,
    });
  });

  it("rejects when ANY resolved record is internal (DNS-rebinding guard)", async () => {
    mockLookup.mockResolvedValue([
      { address: "203.0.113.5", family: 4 },
      { address: "169.254.169.254", family: 4 }, // sneaks in a metadata IP
    ] as never);
    await expect(resolvePublicIp("rebind.example.com")).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects a host that does not resolve", async () => {
    mockLookup.mockResolvedValue([] as never);
    await expect(resolvePublicIp("nope.invalid")).rejects.toBeInstanceOf(SsrfError);
  });
});
