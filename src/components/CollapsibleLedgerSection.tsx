import { useState, type ReactNode } from "react";

type CollapsibleLedgerSectionProps = {
  headingId: string;
  title: string;
  lede?: ReactNode;
  summaryExtra?: ReactNode;
  defaultOpen?: boolean;
  contentClassName?: string;
  children: ReactNode;
};

export function CollapsibleLedgerSection({
  headingId,
  title,
  lede,
  summaryExtra,
  defaultOpen = false,
  contentClassName = "mt-3 space-y-3",
  children,
}: CollapsibleLedgerSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      className="group ledger-panel p-[22px]"
      open={isOpen}
      aria-labelledby={headingId}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h2 id={headingId} className="section-heading !text-left">
            {title}
          </h2>
          {summaryExtra}
        </div>
        <span
          aria-hidden
          className="shrink-0 text-[14px] text-[var(--ink-faint)] transition-transform duration-200 group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      {lede ? (
        <div className="section-intro mt-1.5 !items-start !text-left [&_.section-lede]:!text-left">
          {typeof lede === "string" ? (
            <p className="section-lede">{lede}</p>
          ) : (
            lede
          )}
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </details>
  );
}
