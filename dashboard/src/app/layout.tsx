import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Experiments",
  description: "Experimentation platform dashboard",
};

function BeakerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M12 3v6m0 0l5.2 8.8a2 2 0 01-1.72 3.2H8.52a2 2 0 01-1.72-3.2L12 9z" />
    </svg>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.className}>
      <body className="bg-white text-zinc-900 antialiased">
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="flex w-56 flex-col border-r border-zinc-200 bg-zinc-50/50">
            <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-4">
              <BeakerIcon className="h-5 w-5 text-zinc-800" />
              <span className="text-sm font-semibold tracking-tight text-zinc-900">
                Experiments
              </span>
            </div>
            <nav className="flex flex-col gap-0.5 p-3">
              <NavLink href="/">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Overview
              </NavLink>
              <NavLink href="/environments">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4m0 14v4m-8.66-5.66l2.83-2.83m11.31-5.66l2.83-2.83M1 12h4m14 0h4m-5.66 8.66l-2.83-2.83M8.17 8.17L5.34 5.34" />
                </svg>
                Environments
              </NavLink>
              <NavLink href="/experiments">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3h6M12 3v6m0 0l5.2 8.8a2 2 0 01-1.72 3.2H8.52a2 2 0 01-1.72-3.2L12 9z" />
                </svg>
                Experiments
              </NavLink>
              <NavLink href="/audiences">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="3" />
                  <circle cx="16" cy="8" r="3" />
                  <path d="M3 19a5 5 0 0 1 10 0" />
                  <path d="M11 19a5 5 0 0 1 10 0" />
                </svg>
                Audiences
              </NavLink>
            </nav>
            <div className="mt-auto border-t border-zinc-200 px-5 py-3">
              <p className="text-xs text-zinc-400">v0.1.0</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            <ToastProvider>{children}</ToastProvider>
          </main>
        </div>
      </body>
    </html>
  );
}
