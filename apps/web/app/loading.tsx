/** Fallback loading for public/dynamic routes (booking pages etc.). */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
      <div
        aria-label="Loading"
        className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]"
      />
    </div>
  );
}
