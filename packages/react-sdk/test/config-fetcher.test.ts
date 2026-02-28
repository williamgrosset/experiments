import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigFetcher } from "../src/config-fetcher.js";
import { createTestSnapshot, createVersionResponse } from "./fixtures.js";

function mockFetch(responses: Array<{ ok: boolean; body: unknown; status?: number }>) {
  let callIndex = 0;
  return vi.fn(async () => {
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      statusText: response.ok ? "OK" : "Internal Server Error",
      json: async () => response.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

describe("ConfigFetcher", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  describe("fetchVersion", () => {
    it("fetches and returns the version number", async () => {
      const snapshot = createTestSnapshot();
      globalThis.fetch = mockFetch([
        { ok: true, body: createVersionResponse(snapshot.version) },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        60000,
        vi.fn()
      );

      const version = await fetcher.fetchVersion();
      expect(version).toBe(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://cdn.example.com/configs/test/version.json"
      );
    });

    it("throws on non-OK response", async () => {
      globalThis.fetch = mockFetch([
        { ok: false, body: {}, status: 404 },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        60000,
        vi.fn()
      );

      await expect(fetcher.fetchVersion()).rejects.toThrow(
        "Failed to fetch version"
      );
    });
  });

  describe("fetchSnapshot", () => {
    it("fetches and returns the config snapshot", async () => {
      const snapshot = createTestSnapshot();
      globalThis.fetch = mockFetch([{ ok: true, body: snapshot }]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        60000,
        vi.fn()
      );

      const result = await fetcher.fetchSnapshot();
      expect(result.version).toBe(1);
      expect(result.experiments).toHaveLength(2);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://cdn.example.com/configs/test/snapshots/latest.json"
      );
    });

    it("strips trailing slashes from base URL", async () => {
      const snapshot = createTestSnapshot();
      globalThis.fetch = mockFetch([{ ok: true, body: snapshot }]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com///",
        "test",
        60000,
        vi.fn()
      );

      await fetcher.fetchSnapshot();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://cdn.example.com/configs/test/snapshots/latest.json"
      );
    });

    it("throws on non-OK response", async () => {
      globalThis.fetch = mockFetch([
        { ok: false, body: {}, status: 500 },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        60000,
        vi.fn()
      );

      await expect(fetcher.fetchSnapshot()).rejects.toThrow(
        "Failed to fetch config snapshot"
      );
    });
  });

  describe("poll", () => {
    it("returns the snapshot when the version has changed", async () => {
      const snapshot = createTestSnapshot();
      globalThis.fetch = mockFetch([
        { ok: true, body: createVersionResponse(1) },
        { ok: true, body: snapshot },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        60000,
        vi.fn()
      );

      const result = await fetcher.poll();
      expect(result).not.toBeNull();
      expect(result!.version).toBe(1);
    });

    it("returns null when the version has not changed", async () => {
      globalThis.fetch = mockFetch([
        { ok: true, body: createVersionResponse(1) },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        60000,
        vi.fn()
      );
      fetcher.setCurrentVersion(1);

      const result = await fetcher.poll();
      expect(result).toBeNull();
      // Should only have called fetchVersion, not fetchSnapshot
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("fetches snapshot when version increments", async () => {
      const snapshot = createTestSnapshot({ version: 2 });
      globalThis.fetch = mockFetch([
        { ok: true, body: createVersionResponse(2) },
        { ok: true, body: snapshot },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        60000,
        vi.fn()
      );
      fetcher.setCurrentVersion(1);

      const result = await fetcher.poll();
      expect(result).not.toBeNull();
      expect(result!.version).toBe(2);
    });

    it("ignores version rollbacks (version < current)", async () => {
      globalThis.fetch = mockFetch([
        { ok: true, body: createVersionResponse(1) },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        60000,
        vi.fn()
      );
      fetcher.setCurrentVersion(2);

      const result = await fetcher.poll();
      expect(result).toBeNull();
      // Should only have called fetchVersion, not fetchSnapshot
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("applies stale-write guard when snapshot version is older than current", async () => {
      // Simulate a race: version.json says 3, but the snapshot fetched is still version 1
      globalThis.fetch = mockFetch([
        { ok: true, body: createVersionResponse(3) },
        { ok: true, body: createTestSnapshot({ version: 1 }) },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        60000,
        vi.fn()
      );
      fetcher.setCurrentVersion(2);

      const result = await fetcher.poll();
      expect(result).toBeNull();
    });
  });

  describe("start / destroy", () => {
    it("calls onUpdate when version changes during polling", async () => {
      const snapshot = createTestSnapshot({ version: 2 });
      const onUpdate = vi.fn();

      globalThis.fetch = mockFetch([
        { ok: true, body: createVersionResponse(2) },
        { ok: true, body: snapshot },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        5000,
        onUpdate
      );
      fetcher.setCurrentVersion(1);
      fetcher.start();

      // Advance past one interval
      await vi.advanceTimersByTimeAsync(5000);

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith(snapshot);

      fetcher.destroy();
    });

    it("does not call onUpdate after destroy", async () => {
      const snapshot = createTestSnapshot({ version: 2 });
      const onUpdate = vi.fn();

      globalThis.fetch = mockFetch([
        { ok: true, body: createVersionResponse(2) },
        { ok: true, body: snapshot },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        5000,
        onUpdate
      );
      fetcher.setCurrentVersion(1);
      fetcher.start();
      fetcher.destroy();

      await vi.advanceTimersByTimeAsync(10000);

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("does not start polling when interval is 0", async () => {
      const onUpdate = vi.fn();
      globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch;

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        0,
        onUpdate
      );
      fetcher.start();

      await vi.advanceTimersByTimeAsync(60000);

      expect(globalThis.fetch).not.toHaveBeenCalled();

      fetcher.destroy();
    });

    it("swallows errors during polling without throwing", async () => {
      const onUpdate = vi.fn();

      globalThis.fetch = mockFetch([
        { ok: false, body: {}, status: 500 },
      ]);

      const fetcher = new ConfigFetcher(
        "https://cdn.example.com",
        "test",
        5000,
        onUpdate
      );
      fetcher.start();

      // Should not throw
      await vi.advanceTimersByTimeAsync(5000);

      expect(onUpdate).not.toHaveBeenCalled();

      fetcher.destroy();
    });
  });
});
