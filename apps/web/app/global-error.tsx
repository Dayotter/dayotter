"use client";

// global-error replaces the root layout, so it can't rely on app CSS/fonts -
// keep it self-contained with inline brand styling.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf9f6",
          color: "#191720",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        {/* biome-ignore lint/a11y/useAltText: decorative illustration */}
        <img
          src="/brand/illustrations/otter-focus.png"
          alt=""
          width={176}
          height={176}
          style={{ marginBottom: 24 }}
        />
        <h1 style={{ fontSize: 30, margin: 0, fontWeight: 700 }}>Something washed out.</h1>
        <p style={{ color: "#6b6678", maxWidth: 360, marginTop: 10, lineHeight: 1.5 }}>
          A problem broke the whole page. Reload to get the otter back.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 24,
            background: "#6743e6",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "12px 22px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
