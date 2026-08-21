import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { AppDataProvider } from "../hooks/useAppData";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg text-center space-y-4">
        {/* Icon */}
        <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <svg className="h-7 w-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">
            An unexpected error occurred. This has been logged. You can try again or return to the home page.
          </p>
          <p className="mt-3 font-mono text-xs text-destructive bg-destructive/5 border border-destructive/15 rounded-md px-3 py-2 text-left break-all">
            {error.message || "Unknown error"}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * GlobalLoadingScreen
 * Shown while auth is initialising (loading=true). This is the full-screen
 * blocker that prevents AppDataProvider — and its 9 Supabase queries — from
 * mounting before we know who the user is.
 */
function GlobalLoadingScreen({ error }: { error?: string | null }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5">
      {/* Brand mark */}
      <div className="flex items-center gap-3">
        <img 
          src="/SVG_MARK.svg" 
          alt="Logo" 
          className="h-20 w-auto object-contain select-none" 
        />
        <span className="font-display font-bold text-2xl tracking-wider text-primary">
          Forge &amp; Fabric Industries, Inc.
        </span>
      </div>

      {error ? (
        /* Auth failed — show the error inline so the user isn't staring at a spinner */
        <div className="max-w-sm text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-destructive text-sm font-semibold">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.007v.008H12v-.008Zm9.75-4.5a9.75 9.75 0 1 1-19.5 0 9.75 9.75 0 0 1 19.5 0Z" />
            </svg>
            Connection error
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reload page
          </a>
        </div>
      ) : (
        /* Normal loading state */
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          </div>
          <p className="text-xs text-muted-foreground tracking-wide">
            Initialising session…
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * AuthGate
 * Sits between AuthProvider and AppDataProvider.
 * - While auth is loading → render GlobalLoadingScreen (no data queries fire)
 * - If auth errored → render error state inside GlobalLoadingScreen
 * - Once loading is false → render children (AppDataProvider + routes)
 *
 * This solves two problems:
 * 1. AppDataProvider's 9 queries no longer race against auth init
 * 2. Users always see a clear loading indicator instead of a frozen screen
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, authError } = useAuth();

  useEffect(() => {
    if (user?.display_theme) {
      const isDark = user.display_theme === "dark" || 
        (user.display_theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [user?.display_theme]);

  if (loading) {
    return <GlobalLoadingScreen />;
  }

  if (authError) {
    return <GlobalLoadingScreen error={authError} />;
  }

  return <>{children}</>;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Forge & Fabric Industries, Inc. — Production Tracker" },
      { name: "description", content: "Internal production tracker for Forge & Fabric Industries, Inc.: cut, make, trim garment conversion across a 13-stage pipeline." },
      { name: "author", content: "Forge & Fabric Industries, Inc." },
      { property: "og:title", content: "Forge & Fabric Industries, Inc. — Production Tracker" },
      { property: "og:description", content: "Live 13-stage garment production floor for the Forge & Fabric Industries, Inc. ops team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/*
          AuthGate waits for auth to resolve before mounting AppDataProvider.
          This prevents all 9 Supabase data queries from firing before the
          user session is known, which was the primary cause of the freeze.
        */}
        <AuthGate>
          <AppDataProvider>
            <Outlet />
          </AppDataProvider>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}
