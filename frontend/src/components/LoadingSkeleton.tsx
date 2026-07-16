export default function LoadingSkeleton() {
  return (
    <div className="w-full animate-pulse space-y-4">
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-2 h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-1 h-3 w-4/5 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
