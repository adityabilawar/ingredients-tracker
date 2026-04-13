"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 font-sans">
        <h2 className="text-xl font-semibold">Application error</h2>
        <p className="text-center text-sm opacity-80">{error.message}</p>
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
