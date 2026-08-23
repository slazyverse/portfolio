"use client";

import { useScrubbedSteps } from "@/hooks/useScrubbedSteps";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
 * The request trace.
 *
 * One request descending through VAYU-DRISHTI's layers, carrying a single
 * request ID bound into structlog's contextvars. The point the diagram makes
 * is that the same ID appears on every line — which is exactly what makes a
 * production incident traceable instead of guesswork.
 *
 * This is also the site's descent metaphor at its most literal: the reader
 * scrolls down, and the request goes down with them.
 * ------------------------------------------------------------------------- */

const REQUEST_ID = "8f3c1a7e";

interface Layer {
  name: string;
  file: string;
  log?: string;
}

const LAYERS: Layer[] = [
  {
    name: "CORS + request-ID middleware",
    file: "app/main.py",
    log: `{"event":"request.start","request_id":"${REQUEST_ID}","path":"/api/v1/aqi"}`,
  },
  {
    name: "Versioned router",
    file: "app/api/v1/router.py",
  },
  {
    name: "Endpoint handler",
    file: "app/api/v1/endpoints/aqi.py",
    log: `{"event":"aqi.request","request_id":"${REQUEST_ID}","bbox":"68,8,97,37"}`,
  },
  {
    name: "Service layer",
    file: "app/services/aqi_service.py",
    log: `{"event":"aqi.query","request_id":"${REQUEST_ID}","stations":142}`,
  },
  {
    name: "Async session",
    file: "app/db/session.py",
    log: `{"event":"db.execute","request_id":"${REQUEST_ID}","ms":11.4}`,
  },
  {
    name: "PostgreSQL + PostGIS",
    file: "asyncpg",
  },
];

/** One step per layer, plus the response. */
const STEP_COUNT = LAYERS.length + 1;

export function RequestTrace() {
  const { trackRef, step, reduced } = useScrubbedSteps(STEP_COUNT);
  const complete = step >= LAYERS.length;

  return (
    <div ref={trackRef} className={reduced ? undefined : "relative h-[340vh]"}>
      <figure
        className={cn(
          "border border-[var(--hair)] bg-[var(--panel)]",
          !reduced && "sticky top-24",
        )}
      >
        <figcaption className="t-label flex items-center justify-between gap-4 border-b border-[var(--hair)] px-5 py-3 text-[var(--fg-low)]">
          <span>X-Request-ID</span>
          <span className="t-mono text-[var(--accent)] normal-case">
            {REQUEST_ID}
          </span>
        </figcaption>

        <ol className="px-5 py-4">
          {LAYERS.map((layer, i) => {
            const reached = step > i;
            const active = step === i + 1;

            return (
              <li key={layer.file} className="relative pb-5 pl-8 last:pb-0">
                {/* The thread the request travels down. */}
                {i < LAYERS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "step absolute top-3 left-[5px] w-px",
                      reached
                        ? "bg-[var(--accent)]"
                        : "bg-[var(--hair)]",
                    )}
                    style={{ bottom: 0 }}
                  />
                )}

                <span
                  aria-hidden="true"
                  className={cn(
                    "step absolute top-[7px] left-0 h-[11px] w-[11px] rounded-full border",
                    reached
                      ? "border-[var(--accent)] bg-[var(--accent)]"
                      : "border-[var(--hair-strong)] bg-[var(--panel)]",
                    active && "scale-125",
                  )}
                />

                <div
                  className={cn(
                    "step",
                    reached ? "opacity-100" : "opacity-40",
                  )}
                >
                  <p
                    className={cn(
                      "t-small",
                      reached ? "text-[var(--fg-hi)]" : "text-[var(--fg-mid)]",
                    )}
                  >
                    {layer.name}
                  </p>
                  <p className="t-mono text-[var(--fg-low)]">{layer.file}</p>

                  {layer.log && (
                    <pre
                      className={cn(
                        "step t-mono mt-2 overflow-x-auto border-l-2 py-1.5 pl-3",
                        reached
                          ? "border-[var(--accent)] text-[var(--fg-mid)]"
                          : "border-[var(--hair)] text-[var(--fg-low)]",
                      )}
                    >
                      <code>{layer.log}</code>
                    </pre>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p
          aria-live="polite"
          className={cn(
            "step t-mono border-t px-5 py-3",
            complete
              ? "border-[var(--hair)] text-[var(--state-safe)]"
              : "border-[var(--hair)] text-[var(--fg-low)]",
          )}
        >
          {complete
            ? `200 OK — every log line above carries request_id ${REQUEST_ID}`
            : "One request, descending. Each layer logs under the same ID."}
        </p>
      </figure>
    </div>
  );
}
