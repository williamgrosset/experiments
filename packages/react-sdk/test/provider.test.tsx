import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { useContext } from "react";
import { ExperimentsProvider } from "../src/provider.js";
import { ExperimentsContext } from "../src/context.js";
import { createTestSnapshot } from "./fixtures.js";

function mockFetchWith(snapshot: ReturnType<typeof createTestSnapshot>) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => snapshot,
  })) as unknown as typeof globalThis.fetch;
}

function mockFetchError(status: number, statusText: string) {
  return vi.fn(async () => ({
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  })) as unknown as typeof globalThis.fetch;
}

/** Test component that renders context values for assertion. */
function ContextInspector() {
  const ctx = useContext(ExperimentsContext);
  return (
    <div>
      <span data-testid="is-ready">{String(ctx.isReady)}</span>
      <span data-testid="is-loading">{String(ctx.isLoading)}</span>
      <span data-testid="error">{ctx.error?.message ?? "none"}</span>
      <span data-testid="version">{String(ctx.configVersion)}</span>
      <span data-testid="assignment-count">{ctx.assignments.size}</span>
      {Array.from(ctx.assignments.entries()).map(([key, a]) => (
        <span key={key} data-testid={`assignment-${key}`}>
          {a.variant_key}
        </span>
      ))}
    </div>
  );
}

describe("ExperimentsProvider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetches config on mount and provides assignments", async () => {
    const snapshot = createTestSnapshot();
    globalThis.fetch = mockFetchWith(snapshot);

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          pollingInterval={0}
        >
          <ContextInspector />
        </ExperimentsProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-ready").textContent).toBe("true");
    });

    expect(screen.getByTestId("is-loading").textContent).toBe("false");
    expect(screen.getByTestId("error").textContent).toBe("none");
    expect(screen.getByTestId("version").textContent).toBe("1");
    // user-1 has no country context, so only checkout-flow should match
    expect(screen.getByTestId("assignment-checkout-flow").textContent).toBe(
      "control"
    );
  });

  it("uses initialSnapshot without fetching", async () => {
    const snapshot = createTestSnapshot();
    globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch;

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          initialSnapshot={snapshot}
          pollingInterval={0}
        >
          <ContextInspector />
        </ExperimentsProvider>
      );
    });

    expect(screen.getByTestId("is-ready").textContent).toBe("true");
    expect(screen.getByTestId("is-loading").textContent).toBe("false");
    expect(screen.getByTestId("version").textContent).toBe("1");
    // Should not have called fetch since we provided a snapshot
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("evaluates targeting rules against user context", async () => {
    const snapshot = createTestSnapshot();
    globalThis.fetch = mockFetchWith(snapshot);

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          context={{ country: "US" }}
          pollingInterval={0}
        >
          <ContextInspector />
        </ExperimentsProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-ready").textContent).toBe("true");
    });

    // Both experiments should match: checkout-flow (no targeting) + us-only-feature (country=US)
    expect(screen.getByTestId("assignment-count").textContent).toBe("2");
    expect(screen.getByTestId("assignment-checkout-flow").textContent).toBe(
      "control"
    );
    expect(screen.getByTestId("assignment-us-only-feature").textContent).toBe(
      "treatment"
    );
  });

  it("excludes experiments that do not match targeting", async () => {
    const snapshot = createTestSnapshot();
    globalThis.fetch = mockFetchWith(snapshot);

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          context={{ country: "CA" }}
          pollingInterval={0}
        >
          <ContextInspector />
        </ExperimentsProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-ready").textContent).toBe("true");
    });

    // Only checkout-flow should match; us-only-feature requires country=US
    expect(screen.getByTestId("assignment-count").textContent).toBe("1");
    expect(screen.getByTestId("assignment-checkout-flow").textContent).toBe(
      "control"
    );
  });

  it("sets error state when fetch fails", async () => {
    globalThis.fetch = mockFetchError(500, "Internal Server Error");

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          pollingInterval={0}
        >
          <ContextInspector />
        </ExperimentsProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("is-ready").textContent).toBe("false");
    expect(screen.getByTestId("error").textContent).toContain(
      "Failed to fetch config snapshot"
    );
    expect(screen.getByTestId("assignment-count").textContent).toBe("0");
  });

  it("shows loading state initially", async () => {
    // Use a fetch that never resolves to capture loading state
    globalThis.fetch = vi.fn(
      () => new Promise(() => {})
    ) as unknown as typeof globalThis.fetch;

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          pollingInterval={0}
        >
          <ContextInspector />
        </ExperimentsProvider>
      );
    });

    expect(screen.getByTestId("is-loading").textContent).toBe("true");
    expect(screen.getByTestId("is-ready").textContent).toBe("false");
  });
});
