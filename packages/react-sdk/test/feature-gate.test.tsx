import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ExperimentsProvider } from "../src/provider.js";
import { FeatureGate } from "../src/feature-gate.js";
import { createTestSnapshot } from "./fixtures.js";

describe("FeatureGate", () => {

  it("renders children when the user matches the specified variant", async () => {
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
          <FeatureGate experiment="checkout-flow" variant="control">
            <span data-testid="gated">visible</span>
          </FeatureGate>
        </ExperimentsProvider>
      );
    });

    expect(screen.getByTestId("gated").textContent).toBe("visible");
  });

  it("does not render children when the user is in a different variant", async () => {
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
          <FeatureGate experiment="checkout-flow" variant="treatment">
            <span data-testid="gated">visible</span>
          </FeatureGate>
        </ExperimentsProvider>
      );
    });

    expect(screen.queryByTestId("gated")).toBeNull();
  });

  it("renders fallback when the user is not assigned to the experiment", async () => {
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
          <FeatureGate
            experiment="nonexistent"
            variant="treatment"
            fallback={<span data-testid="fallback">fallback</span>}
          >
            <span data-testid="gated">visible</span>
          </FeatureGate>
        </ExperimentsProvider>
      );
    });

    expect(screen.queryByTestId("gated")).toBeNull();
    expect(screen.getByTestId("fallback").textContent).toBe("fallback");
  });

  it("renders fallback when the user does not match targeting rules", async () => {
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
          <FeatureGate
            experiment="us-only-feature"
            variant="treatment"
            fallback={<span data-testid="fallback">not eligible</span>}
          >
            <span data-testid="gated">eligible</span>
          </FeatureGate>
        </ExperimentsProvider>
      );
    });

    expect(screen.queryByTestId("gated")).toBeNull();
    expect(screen.getByTestId("fallback").textContent).toBe("not eligible");
  });

  it("supports an array of variant keys", async () => {
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
          <FeatureGate
            experiment="checkout-flow"
            variant={["control", "treatment"]}
          >
            <span data-testid="gated">visible</span>
          </FeatureGate>
        </ExperimentsProvider>
      );
    });

    // User is in "control", which is in the array
    expect(screen.getByTestId("gated").textContent).toBe("visible");
  });

  it("renders nothing (no fallback) when not matched and no fallback provided", async () => {
    const snapshot = createTestSnapshot();

    const { container } = await act(async () => {
      return render(
        <ExperimentsProvider
          configUrl="https://cdn.example.com"
          environment="test"
          userKey="user-1"
          initialSnapshot={snapshot}
          pollingInterval={0}
        >
          <FeatureGate experiment="nonexistent" variant="treatment">
            <span data-testid="gated">visible</span>
          </FeatureGate>
        </ExperimentsProvider>
      );
    });

    expect(screen.queryByTestId("gated")).toBeNull();
    // The FeatureGate should render nothing
    expect(container.innerHTML).toBe("");
  });
});
