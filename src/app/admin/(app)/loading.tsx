// Shown instantly on every admin navigation while the page loads fresh (uncached) data.
export default function AdminLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
