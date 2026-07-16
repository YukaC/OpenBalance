export function ViewSkeleton() {
  return (
    <div
      className="view-stack animate-pulse"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true" className="space-y-2.5">
        <div className="h-8 w-36 rounded-lg bg-[var(--line)]" />
        <div className="h-4 w-52 max-w-full rounded bg-[var(--line)]/80" />
      </div>
      <div aria-hidden="true" className="ledger-panel h-[4.5rem] bg-[var(--line)]/50" />
      <div aria-hidden="true" className="ledger-panel h-40 bg-[var(--line)]/40" />
      <div aria-hidden="true" className="ledger-panel h-28 bg-[var(--line)]/35" />
    </div>
  );
}
