import { createPortal } from "react-dom";
import { WELLNESS_PLAN_PRINT_STATUS_TEXT, type WellnessPlanPrintSnapshot } from "./wellnessPlanPrint";

const PRINT_LOGO_SRC = "/logos/logo white.png"; // the dark Solace wordmark, for white paper

/**
 * Print-only copy of the Wellness Plan (hidden on screen; see wellnessPlanPrint.css). Rendered
 * at the end of <body>, outside the app's scroll and height-limited containers, so the browser
 * can flow it across as many pages as it needs.
 */
export function WellnessPlanPrintDocument({ snapshot }: { snapshot: WellnessPlanPrintSnapshot | null }) {
  if (typeof document === "undefined" || !snapshot) return null;
  const { plan } = snapshot;
  const status = plan ? WELLNESS_PLAN_PRINT_STATUS_TEXT[plan.status] : null;

  return createPortal(
    <div className="wellness-plan-print-doc" data-testid="wellness-plan-print-doc" aria-hidden="true">
      <header className="wp-print-header">
        <img className="wp-print-logo" src={PRINT_LOGO_SRC} alt="Solace" />
        <h1>Wellness Plan</h1>
        <p className="wp-print-meta">
          Printed {snapshot.printedAt.text} ({snapshot.printedAt.timeZone})
        </p>
        {status ? (
          <p
            className={
              plan?.status === "saved"
                ? "wp-print-status"
                : "wp-print-status wp-print-status-draft"
            }
          >
            <strong>{status.label}.</strong> {status.detail}
          </p>
        ) : null}
      </header>

      {!plan ? (
        <p className="wp-print-empty">
          Your wellness plan hadn&apos;t finished loading, so it isn&apos;t included. Wait for it to load,
          then print again.
        </p>
      ) : (
        <>
          {snapshot.resources.length > 0 ? (
            <section className="wp-print-section">
              <h2>Helpful Resources — Available 24/7</h2>
              <ul className="wp-print-list wp-print-plain">
                {snapshot.resources.map((r) => (
                  <li key={`${r.name}-${r.phone}`}>
                    <strong>{r.name}</strong>: {r.phone}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {plan.sections.map((section) => (
            <section key={section.id} className="wp-print-section">
              <h2>{section.title}</h2>
              <p className="wp-print-description">{section.description}</p>
              {section.items.length > 0 ? (
                <ol className="wp-print-list wp-print-numbered">
                  {section.items.map((item, index) => (
                    <li key={item.id}>
                      {/* Number on the left as on screen; the text keeps its own direction (Urdu right-to-left). */}
                      <span className="wp-print-num">{index + 1}.</span>
                      <span className="wp-print-text" dir="auto">
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="wp-print-empty">Nothing added yet.</p>
              )}
            </section>
          ))}

          <section className="wp-print-section">
            <h2>Trusted Contacts</h2>
            <p className="wp-print-description">People you can reach out to.</p>
            {snapshot.contacts === null ? (
              <p className="wp-print-empty">Contacts were still loading, so they aren&apos;t included.</p>
            ) : snapshot.contacts.length === 0 ? (
              <p className="wp-print-empty">No trusted contacts added.</p>
            ) : (
              <ul className="wp-print-list wp-print-plain">
                {snapshot.contacts.map((c) => (
                  <li key={c.id} dir="auto">
                    <strong>{c.name}</strong>: {c.phone || "No phone on file"}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="wp-print-section">
            <h2>Recovery Readiness</h2>
            <p>Your current wellness score: {plan.recoveryPercent}%</p>
          </section>
        </>
      )}
    </div>,
    document.body
  );
}
