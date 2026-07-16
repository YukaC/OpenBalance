"use client";

import { useEffect, useState } from "react";
import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { shouldShowDownloadAppBanner } from "@/lib/device";

const androidDownloadUrl =
  process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_URL?.trim() || "";
const iosDownloadUrl = process.env.NEXT_PUBLIC_IOS_DOWNLOAD_URL?.trim() || "";

const hasAndroidUrl = Boolean(androidDownloadUrl && androidDownloadUrl !== "#");
const hasIosUrl = Boolean(iosDownloadUrl && iosDownloadUrl !== "#");

export function DownloadAppSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(shouldShowDownloadAppBanner());
  }, []);

  if (!isVisible) return null;

  return (
    <CollapsibleLedgerSection
      headingId="download-app-heading"
      title="Descargá la app"
      lede="Usá Rinde en tu teléfono con la app nativa. Más rápida y lista para el día a día."
      defaultOpen
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={hasAndroidUrl ? androidDownloadUrl : "#"}
          target={hasAndroidUrl ? "_blank" : undefined}
          rel={hasAndroidUrl ? "noopener noreferrer" : undefined}
          aria-disabled={!hasAndroidUrl}
          className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[var(--select)] text-[14px] font-bold text-[var(--chip-active-text)] transition-colors hover:opacity-90 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          onClick={(event) => {
            if (!hasAndroidUrl) event.preventDefault();
          }}
        >
          Android
        </a>
        <a
          href={hasIosUrl ? iosDownloadUrl : "#"}
          target={hasIosUrl ? "_blank" : undefined}
          rel={hasIosUrl ? "noopener noreferrer" : undefined}
          aria-disabled={!hasIosUrl}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)] aria-disabled:pointer-events-none aria-disabled:opacity-50"
          onClick={(event) => {
            if (!hasIosUrl) event.preventDefault();
          }}
        >
          iOS
        </a>
      </div>
      {!hasAndroidUrl && !hasIosUrl ? (
        <p className="text-[12px] leading-relaxed text-[var(--ink-soft)]">
          La build nativa llega pronto. Cuando esté publicada, estos enlaces
          apuntarán a la tienda. Si necesitás acceso anticipado, contactanos.
        </p>
      ) : !hasAndroidUrl || !hasIosUrl ? (
        <p className="text-[12px] leading-relaxed text-[var(--ink-soft)]">
          {!hasAndroidUrl
            ? "El enlace de Android aún no está disponible."
            : "El enlace de iOS aún no está disponible."}{" "}
          La publicación en tienda llega pronto.
        </p>
      ) : null}
    </CollapsibleLedgerSection>
  );
}
