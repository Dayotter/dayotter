export default function PaymentFailedPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-danger)]/15 text-2xl text-[var(--color-danger)]">
        !
      </div>
      <h1 className="font-display mt-5 text-2xl">That time was just taken</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Someone booked this slot while you were paying, so we couldn't confirm your booking. Your
        payment has been refunded in full - please pick another time.
      </p>
    </main>
  );
}
