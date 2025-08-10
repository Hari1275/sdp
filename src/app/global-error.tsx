"use client";

import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error }: { error: unknown }) {
  // Report React render errors
  Sentry.captureException(error);
  return (
    <html>
      <body>
        <div style={{ padding: 24 }}>
          <h2>Something went wrong</h2>
          <p>Please try again later.</p>
        </div>
      </body>
    </html>
  );
}
