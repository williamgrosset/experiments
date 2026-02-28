import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Automatically clean up the DOM after each test to prevent
// elements from prior renders leaking into subsequent tests.
afterEach(() => {
  cleanup();
});
