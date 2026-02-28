import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ExperimentsProvider } from "../src/provider.js";
import { useExperiment } from "../src/use-experiment.js";
import { useExperiments } from "../src/use-experiments.js";
import { createTestSnapshot } from "./fixtures.js";

// --- useExperiment test components ---

function UseExperimentTester({ experimentKey }: { experimentKey: string }) {
  const { variant, payload, isReady, isLoading, error } =
    useExperiment(experimentKey);
  return (
    <div>
      <span data-testid="variant">{variant ?? "null"}</span>
      <span data-testid="payload">{JSON.stringify(payload ?? null)}</span>
      <span data-testid="is-ready">{String(isReady)}</span>
      <span data-testid="is-loading">{String(isLoading)}</span>
      <span data-testid="error">{error?.message ?? "none"}</span>
    </div>
  );
}

// --- useExperiments test components ---

function UseExperimentsTester() {
  const { assignments, isReady, isLoading, error } = useExperiments();
  return (
    <div>
      <span data-testid="is-ready">{String(isReady)}</span>
      <span data-testid="is-loading">{String(isLoading)}</span>
      <span data-testid="error">{error?.message ?? "none"}</span>
      <span data-testid="keys">
        {Object.keys(assignments).sort().join(",")}
      </span>
      {Object.entries(assignments).map(([key, a]) => (
        <span key={key} data-testid={`exp-${key}`}>
          {a.variant}|{JSON.stringify(a.payload ?? null)}
        </span>
      ))}
    </div>
  );
}

describe("useExperiment", () => {

  it("returns the assigned variant and payload for a matching experiment", async () => {
    const snapshot = createTestSnapshot();

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          initialSnapshot={snapshot}
          pollingInterval={0}
        >
          <UseExperimentTester experimentKey="checkout-flow" />
        </ExperimentsProvider>
      );
    });

    expect(screen.getByTestId("variant").textContent).toBe("control");
    expect(screen.getByTestId("payload").textContent).toBe(
      JSON.stringify({ color: "blue" })
    );
    expect(screen.getByTestId("is-ready").textContent).toBe("true");
    expect(screen.getByTestId("is-loading").textContent).toBe("false");
  });

  it("returns null variant for a non-matching experiment", async () => {
    const snapshot = createTestSnapshot();

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          initialSnapshot={snapshot}
          pollingInterval={0}
        >
          <UseExperimentTester experimentKey="nonexistent-experiment" />
        </ExperimentsProvider>
      );
    });

    expect(screen.getByTestId("variant").textContent).toBe("null");
    expect(screen.getByTestId("is-ready").textContent).toBe("true");
  });

  it("returns null variant when targeting rules exclude the user", async () => {
    const snapshot = createTestSnapshot();

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          context={{ country: "CA" }}
          initialSnapshot={snapshot}
          pollingInterval={0}
        >
          <UseExperimentTester experimentKey="us-only-feature" />
        </ExperimentsProvider>
      );
    });

    // us-only-feature requires country=US, user has country=CA
    expect(screen.getByTestId("variant").textContent).toBe("null");
  });

  it("returns the variant when targeting rules match the user", async () => {
    const snapshot = createTestSnapshot();

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          context={{ country: "US" }}
          initialSnapshot={snapshot}
          pollingInterval={0}
        >
          <UseExperimentTester experimentKey="us-only-feature" />
        </ExperimentsProvider>
      );
    });

    expect(screen.getByTestId("variant").textContent).toBe("treatment");
    expect(screen.getByTestId("payload").textContent).toBe(
      JSON.stringify({ locale: "en-US" })
    );
  });
});

describe("useExperiments", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns all assignments as a flat record", async () => {
    const snapshot = createTestSnapshot();

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          context={{ country: "US" }}
          initialSnapshot={snapshot}
          pollingInterval={0}
        >
          <UseExperimentsTester />
        </ExperimentsProvider>
      );
    });

    expect(screen.getByTestId("is-ready").textContent).toBe("true");
    expect(screen.getByTestId("keys").textContent).toBe(
      "checkout-flow,us-only-feature"
    );
    expect(screen.getByTestId("exp-checkout-flow").textContent).toBe(
      'control|{"color":"blue"}'
    );
    expect(screen.getByTestId("exp-us-only-feature").textContent).toBe(
      'treatment|{"locale":"en-US"}'
    );
  });

  it("only includes experiments that match targeting", async () => {
    const snapshot = createTestSnapshot();

    await act(async () => {
      render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          context={{ country: "CA" }}
          initialSnapshot={snapshot}
          pollingInterval={0}
        >
          <UseExperimentsTester />
        </ExperimentsProvider>
      );
    });

    expect(screen.getByTestId("keys").textContent).toBe("checkout-flow");
  });

  it("returns empty record before config loads", async () => {
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
          <UseExperimentsTester />
        </ExperimentsProvider>
      );
    });

    expect(screen.getByTestId("is-loading").textContent).toBe("true");
    expect(screen.getByTestId("keys").textContent).toBe("");
  });
});
