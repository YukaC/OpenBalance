/** Thin App Router entry — real UI is rendered by AppShell from eager view modules. */

/** Required for `NEXT_OUTPUT=export` (Capacitor mobile build). */
export function generateStaticParams() {
  return [{ slug: [] as string[] }];
}

export default function AppPage() {
  return null;
}
