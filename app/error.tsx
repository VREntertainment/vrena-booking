'use client'

export default function ErrorPage({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <main className="app section" role="alert">
      <h1>We couldn’t load this page</h1>
      <p>Your connection may have been interrupted. Try again, or return to booking.</p>
      <div className="staff-row-actions">
        <button type="button" onClick={() => unstable_retry()}>Try again</button>
        <a href="/tickets">Return to booking</a>
      </div>
    </main>
  )
}
