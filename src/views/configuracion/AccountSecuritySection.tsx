"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { getApiBaseUrl, isAuthEnabled } from "@/lib/auth-flags";

const API_BASE = getApiBaseUrl();

export function AccountSecuritySection() {
  const { data: session, status } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authEnabled = isAuthEnabled();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);

  if (!authEnabled || !isAuthenticated) {
    return null;
  }

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    if (currentPassword.length < 1) {
      setErrorMessage("Ingresá tu contraseña actual.");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (currentPassword === newPassword) {
      setErrorMessage("La nueva contraseña debe ser distinta a la actual.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        if (payload.error === "Current password is incorrect") {
          setErrorMessage("La contraseña actual es incorrecta.");
        } else if (payload.error === "Password must be at least 8 characters") {
          setErrorMessage("La nueva contraseña debe tener al menos 8 caracteres.");
        } else if (payload.error === "New password must be different") {
          setErrorMessage("La nueva contraseña debe ser distinta a la actual.");
        } else if (payload.error === "Too many requests") {
          setErrorMessage("Demasiados intentos. Probá de nuevo en unos minutos.");
        } else if (payload.error === "Unauthorized") {
          setErrorMessage("Tu sesión expiró. Volvé a iniciar sesión.");
        } else if (payload.error === "Database unavailable") {
          setErrorMessage("El servidor no está disponible todavía.");
        } else {
          setErrorMessage(payload.error ?? "No se pudo cambiar la contraseña.");
        }
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatusMessage("Contraseña actualizada.");
    } catch {
      setErrorMessage(
        "No se pudo conectar con el servidor. Revisá tu conexión.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CollapsibleLedgerSection
      headingId="account-security-heading"
      title="Seguridad de la cuenta"
      lede={
        <p className="section-lede">
          Cambiá la contraseña de tu cuenta en la nube. Requiere la contraseña
          actual.
        </p>
      }
    >
      <form
        onSubmit={(event) => {
          void handleChangePassword(event);
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="account-current-password" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Contraseña actual
          </span>
          <input
            id="account-current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          />
        </label>

        <label htmlFor="account-new-password" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Nueva contraseña
          </span>
          <input
            id="account-new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            placeholder="Mínimo 8 caracteres"
          />
        </label>

        <label
          htmlFor="account-confirm-password"
          className="flex flex-col gap-1.5"
        >
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Confirmar nueva contraseña
          </span>
          <input
            id="account-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          />
        </label>

        {errorMessage ? (
          <p className="text-[13px] text-[var(--red)]" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {statusMessage ? (
          <p className="text-[13px] text-[var(--ink-soft)]" role="status">
            {statusMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)] disabled:opacity-50"
        >
          {isSubmitting ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </form>
    </CollapsibleLedgerSection>
  );
}
