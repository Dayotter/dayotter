export default function ProcessingPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-2xl">
        ✓
      </div>
      <h1 className="font-display mt-5 text-2xl">Payment received</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        We're confirming your booking now - a confirmation email with the details is on its way. You
        can safely close this page.
      </p>
    </main>
  );
}
