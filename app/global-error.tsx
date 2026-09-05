'use client'

export default function GlobalError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <main role="alert">
          <h1>VRena couldn’t load</h1>
          <p>Please try again. If you were making a reservation, check its status before submitting again.</p>
          <button type="button" onClick={() => unstable_retry()}>Try again</button>{' '}
          <a href="/tickets">Return to booking</a>
        </main>
      </body>
    </html>
  )
}
