import type { ConfigSnapshot } from "@experiments/shared";

/**
 * Fetch the latest experiment config snapshot from the CDN.
 *
 * This is a standalone async helper with no React dependency, intended for
 * server-side use (e.g., Next.js getServerSideProps, server components,
 * Remix loaders) to pre-fetch the config before rendering.
 *
 * Pass the returned snapshot as `initialSnapshot` to <ExperimentsProvider>
 * to hydrate the client without a loading state.
 *
 * @example
 * ```ts
 * // Next.js App Router — server component
 * import { fetchExperimentsConfig } from "@experiments/react-sdk";
 *
 * export default async function Layout({ children }) {
 *   const snapshot = await fetchExperimentsConfig(
 *     "https://cdn.example.com",
 *     "production"
 *   );
 *
 *   return (
 *     <ExperimentsProvider
 *       configUrl="https://cdn.example.com"
 *       environment="production"
 *       userKey={getUserKey()}
 *       initialSnapshot={snapshot}
 *     >
 *       {children}
 *     </ExperimentsProvider>
 *   );
 * }
 * ```
 */
export async function fetchExperimentsConfig(
  configUrl: string,
  environment: string
): Promise<ConfigSnapshot> {
  const baseUrl = configUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/configs/${environment}/snapshots/latest.json`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch experiment config: ${res.status} ${res.statusText}`
    );
  }

  return (await res.json()) as ConfigSnapshot;
}
