"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { getApiBaseUrl, isAuthEnabled } from "@/lib/auth-flags";
import { useFinanceStore } from "@/store/finance-store";

const API_BASE = getApiBaseUrl();

export function AccountSecuritySection() {
  const { data: session, status, update: updateSession } = useSession();
  const updateProfile = useFinanceStore((s) => s.updateProfile);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailErrorMessage, setEmailErrorMessage] = useState("");
  const [emailStatusMessage, setEmailStatusMessage] = useState("");
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

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

  async function handleChangeEmail(event: React.FormEvent) {
    event.preventDefault();
    setEmailErrorMessage("");
    setEmailStatusMessage("");

    const trimmedEmail = newEmail.trim().toLowerCase();
    if (emailCurrentPassword.length < 1) {
      setEmailErrorMessage("Ingresá tu contraseña actual.");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setEmailErrorMessage("Ingresá un email válido.");
      return;
    }
    if (
      session?.user?.email &&
      trimmedEmail === session.user.email.trim().toLowerCase()
    ) {
      setEmailErrorMessage("El nuevo email debe ser distinto al actual.");
      return;
    }

    setIsSubmittingEmail(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/change-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: emailCurrentPassword,
          newEmail: trimmedEmail,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        email?: string;
      };

      if (!response.ok) {
        if (payload.error === "Current password is incorrect") {
          setEmailErrorMessage("La contraseña actual es incorrecta.");
        } else if (payload.error === "Invalid email") {
          setEmailErrorMessage("Ingresá un email válido.");
        } else if (payload.error === "New email must be different") {
          setEmailErrorMessage("El nuevo email debe ser distinto al actual.");
        } else if (payload.error === "Email already in use") {
          setEmailErrorMessage("Ese email ya está en uso.");
        } else if (payload.error === "Too many requests") {
          setEmailErrorMessage(
            "Demasiados intentos. Probá de nuevo en unos minutos.",
          );
        } else if (payload.error === "Unauthorized") {
          setEmailErrorMessage("Tu sesión expiró. Volvé a iniciar sesión.");
        } else if (payload.error === "Database unavailable") {
          setEmailErrorMessage("El servidor no está disponible todavía.");
        } else {
          setEmailErrorMessage(payload.error ?? "No se pudo cambiar el email.");
        }
        return;
      }

      setEmailCurrentPassword("");
      setNewEmail("");
      setEmailStatusMessage("Email actualizado.");
      if (payload.email) {
        updateProfile({ email: payload.email });
        await updateSession({ email: payload.email });
      }
    } catch {
      setEmailErrorMessage(
        "No se pudo conectar con el servidor. Revisá tu conexión.",
      );
    } finally {
      setIsSubmittingEmail(false);
    }
  }

  return (
    <CollapsibleLedgerSection
      headingId="account-security-heading"
      title="Seguridad de la cuenta"
      lede={
        <p className="section-lede">
          Cambiá el email o la contraseña de tu cuenta en la nube. Requiere la
          contraseña actual.
        </p>
      }
    >
      <form
        onSubmit={(event) => {
          void handleChangeEmail(event);
        }}
        className="flex flex-col gap-3 border-b border-[var(--line)] pb-5"
      >
        <p className="text-[13px] font-semibold text-[var(--ink)]">
          Cambiar email
        </p>
        {session?.user?.email ? (
          <p className="text-[12.5px] text-[var(--ink-soft)]">
            Actual: {session.user.email}
          </p>
        ) : null}

        <label htmlFor="account-new-email" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Nuevo email
          </span>
          <input
            id="account-new-email"
            name="newEmail"
            type="email"
            autoComplete="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          />
        </label>

        <label
          htmlFor="account-email-current-password"
          className="flex flex-col gap-1.5"
        >
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Contraseña actual
          </span>
          <input
            id="account-email-current-password"
            name="emailCurrentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={emailCurrentPassword}
            onChange={(e) => setEmailCurrentPassword(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          />
        </label>

        {emailErrorMessage ? (
          <p className="text-[13px] text-[var(--red)]" role="alert">
            {emailErrorMessage}
          </p>
        ) : null}
        {emailStatusMessage ? (
          <p className="text-[13px] text-[var(--ink-soft)]" role="status">
            {emailStatusMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmittingEmail}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)] disabled:opacity-50"
        >
          {isSubmittingEmail ? "Guardando…" : "Cambiar email"}
        </button>
      </form>

      <form
        onSubmit={(event) => {
          void handleChangePassword(event);
        }}
        className="mt-5 flex flex-col gap-3"
      >
        <p className="text-[13px] font-semibold text-[var(--ink)]">
          Cambiar contraseña
        </p>
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
