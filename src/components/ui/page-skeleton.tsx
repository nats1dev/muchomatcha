export function PageSkeleton({
  cards = 4,
  rows = 6,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mb-6 space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      {cards > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: cards }).map((_, i) => (
            <div
              key={i}
              className="h-[116px] animate-pulse rounded-[12px] border border-border bg-card"
            />
          ))}
        </div>
      ) : null}
      <div className="mt-4 overflow-hidden rounded-[12px] border border-border bg-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-b border-border/70 last:border-b-0"
          >
            <div className="flex h-full items-center gap-4 px-4">
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando contenido…</span>
    </div>
  );
}
