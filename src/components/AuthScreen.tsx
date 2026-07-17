"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { triggerLoginSync } from "@/lib/auto-sync";
import { getApiBaseUrl } from "@/lib/auth-flags";
import { isRunningInNativeApp } from "@/lib/device";
import { loginNativeWithPassword } from "@/lib/native-auth";

type AuthTab = "login" | "register" | "forgot" | "reset";
type AuthErrorField = "name" | "email" | "password" | "credentials";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API_BASE = getApiBaseUrl();
const AUTH_ERROR_ID = "auth-error";
const AUTH_STATUS_ID = "auth-status";

function readResetTokenFromUrl(): string {
  if (typeof window === "undefined") return "";
  const token = new URLSearchParams(window.location.search)
    .get("resetToken")
    ?.trim();
  return token ?? "";
}

function clearResetTokenFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("resetToken")) return;
  url.searchParams.delete("resetToken");
  const next =
    url.pathname +
    (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
    url.hash;
  window.history.replaceState(window.history.state, "", next);
}

export function AuthScreen() {
  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorField, setErrorField] = useState<AuthErrorField | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const tokenFromUrl = readResetTokenFromUrl();
    if (!tokenFromUrl) return;
    setResetToken(tokenFromUrl);
    setActiveTab("reset");
    clearResetTokenFromUrl();
  }, []);

  function setAuthError(message: string, field: AuthErrorField) {
    setErrorMessage(message);
    setErrorField(field);
    setStatusMessage("");
  }

  function clearAuthError() {
    setErrorMessage("");
    setErrorField(null);
  }

  function switchTab(nextTab: AuthTab) {
    setActiveTab(nextTab);
    clearAuthError();
    setStatusMessage("");
    setDevResetUrl("");
    setPassword("");
    setConfirmPassword("");
    if (nextTab !== "reset") {
      setResetToken("");
    }
  }

  async function handleRegister(): Promise<boolean> {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: email.trim(),
        password,
        name: name.trim(),
      }),
    });

    if (!response.ok) {
      let message = "No se pudo crear la cuenta.";
      let field: AuthErrorField = "email";
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error === "Email already registered") {
          message = "Ese email ya está registrado.";
          field = "email";
        } else if (payload.error === "Password must be at least 8 characters") {
          message = "La contraseña debe tener al menos 8 caracteres.";
          field = "password";
        } else if (payload.error === "Invalid email") {
          message = "Ingresá un email válido.";
          field = "email";
        } else if (payload.error === "Name is required") {
          message = "Ingresá tu nombre para continuar.";
          field = "name";
        } else if (payload.error === "Database unavailable") {
          message = "El servidor no está disponible todavía.";
          field = "credentials";
        } else if (payload.error) {
          message = payload.error;
          field = "credentials";
        }
      } catch {
        /* ignore */
      }
      setAuthError(message, field);
      return false;
    }
    return true;
  }

  async function handleCredentialsSignIn(): Promise<boolean> {
    // Capacitor WebView: cookies to Vercel are unreliable — use Bearer JWT (C1).
    if (isRunningInNativeApp()) {
      const nativeResult = await loginNativeWithPassword(
        email.trim(),
        password,
      );
      if (!nativeResult.ok) {
        setAuthError(
          activeTab === "login"
            ? nativeResult.error
            : "Cuenta creada, pero no se pudo iniciar sesión.",
          "credentials",
        );
        return false;
      }
      triggerLoginSync(email.trim().toLowerCase());
      return true;
    }

    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setAuthError(
        activeTab === "login"
          ? "Email o contraseña incorrectos."
          : "Cuenta creada, pero no se pudo iniciar sesión.",
        "credentials",
      );
      return false;
    }
    triggerLoginSync(email.trim().toLowerCase());
    return true;
  }

  async function handleForgotPassword(): Promise<void> {
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setAuthError("Ingresá un email válido.", "email");
      return;
    }

    setIsSubmitting(true);
    clearAuthError();
    setStatusMessage("");
    setDevResetUrl("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        resetUrl?: string;
      };

      if (!response.ok) {
        if (payload.error === "Invalid email") {
          setAuthError("Ingresá un email válido.", "email");
        } else if (payload.error === "Too many requests") {
          setAuthError(
            "Demasiados intentos. Probá de nuevo en unos minutos.",
            "credentials",
          );
        } else if (payload.error === "Database unavailable") {
          setAuthError(
            "El servidor no está disponible todavía.",
            "credentials",
          );
        } else {
          setAuthError(
            payload.error ?? "No se pudo enviar el email de recuperación.",
            "credentials",
          );
        }
        return;
      }

      setStatusMessage(
        payload.message ??
          "Si ese email está registrado, vas a recibir instrucciones para restablecer la contraseña.",
      );
      if (typeof payload.resetUrl === "string" && payload.resetUrl) {
        setDevResetUrl(payload.resetUrl);
      }
    } catch {
      setAuthError(
        "No se pudo conectar con el servidor. Revisá tu conexión.",
        "credentials",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(): Promise<void> {
    if (!resetToken) {
      setAuthError(
        "El enlace de recuperación no es válido. Pedí uno nuevo.",
        "credentials",
      );
      return;
    }
    if (password.length < 8) {
      setAuthError("La contraseña debe tener al menos 8 caracteres.", "password");
      return;
    }
    if (password !== confirmPassword) {
      setAuthError("Las contraseñas no coinciden.", "password");
      return;
    }

    setIsSubmitting(true);
    clearAuthError();
    setStatusMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token: resetToken,
          password,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        if (payload.error === "Password must be at least 8 characters") {
          setAuthError(
            "La contraseña debe tener al menos 8 caracteres.",
            "password",
          );
        } else if (payload.error === "Invalid or expired token") {
          setAuthError(
            "El enlace expiró o ya fue usado. Pedí uno nuevo.",
            "credentials",
          );
        } else if (payload.error === "Token is required") {
          setAuthError(
            "El enlace de recuperación no es válido. Pedí uno nuevo.",
            "credentials",
          );
        } else if (payload.error === "Too many requests") {
          setAuthError(
            "Demasiados intentos. Probá de nuevo en unos minutos.",
            "credentials",
          );
        } else if (payload.error === "Database unavailable") {
          setAuthError(
            "El servidor no está disponible todavía.",
            "credentials",
          );
        } else {
          setAuthError(
            payload.error ?? "No se pudo restablecer la contraseña.",
            "credentials",
          );
        }
        return;
      }

      setResetToken("");
      setPassword("");
      setConfirmPassword("");
      setActiveTab("login");
      setStatusMessage(
        "Contraseña actualizada. Ya podés iniciar sesión con la nueva.",
      );
    } catch {
      setAuthError(
        "No se pudo conectar con el servidor. Revisá tu conexión.",
        "credentials",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (activeTab === "forgot") {
      await handleForgotPassword();
      return;
    }
    if (activeTab === "reset") {
      await handleResetPassword();
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (activeTab === "register" && !trimmedName) {
      setAuthError("Ingresá tu nombre para continuar.", "name");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setAuthError("Ingresá un email válido.", "email");
      return;
    }
    if (password.length < 8) {
      setAuthError("La contraseña debe tener al menos 8 caracteres.", "password");
      return;
    }

    setIsSubmitting(true);
    clearAuthError();
    setStatusMessage("");
    try {
      if (activeTab === "register") {
        const registered = await handleRegister();
        if (!registered) return;
      }
      await handleCredentialsSignIn();
    } catch {
      setAuthError(
        "No se pudo conectar con el servidor. Revisá tu conexión.",
        "credentials",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isNameInvalid = errorField === "name";
  const isEmailInvalid =
    errorField === "email" || errorField === "credentials";
  const isPasswordInvalid =
    errorField === "password" || errorField === "credentials";

  const headingText =
    activeTab === "login"
      ? "Iniciar sesión"
      : activeTab === "register"
        ? "Crear cuenta"
        : activeTab === "forgot"
          ? "Recuperar contraseña"
          : "Nueva contraseña";

  const ledeText =
    activeTab === "forgot"
      ? "Ingresá tu email y te enviamos un enlace para elegir una contraseña nueva."
      : activeTab === "reset"
        ? "Elegí una contraseña nueva para tu cuenta."
        : "Sincronizá tus datos entre dispositivos. La app sigue funcionando sin conexión.";

  const submitLabel =
    activeTab === "login"
      ? "Entrar"
      : activeTab === "register"
        ? "Crear cuenta"
        : activeTab === "forgot"
          ? "Enviar enlace"
          : "Guardar contraseña";

  const showLoginRegisterTabs =
    activeTab === "login" || activeTab === "register";

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[var(--bg)] px-4 py-8">
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="ledger-panel w-full max-w-sm space-y-5 p-6 sm:p-8"
        aria-labelledby="auth-heading"
      >
        <header className="space-y-2 text-center">
          <p className="font-display text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            OpenBalance
          </p>
          <h1
            id="auth-heading"
            className="font-display text-[20px] font-semibold text-[var(--ink)]"
          >
            {headingText}
          </h1>
          <p className="text-[14px] text-[var(--ink-soft)]">{ledeText}</p>
        </header>

        {showLoginRegisterTabs ? (
          <div
            className="flex rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] p-1"
            role="tablist"
            aria-label="Modo de acceso"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "login"}
              onClick={() => {
                switchTab("login");
              }}
              className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors ${
                activeTab === "login"
                  ? "bg-[var(--select)] text-[var(--chip-active-text)]"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "register"}
              onClick={() => {
                switchTab("register");
              }}
              className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors ${
                activeTab === "register"
                  ? "bg-[var(--select)] text-[var(--chip-active-text)]"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              Registrarse
            </button>
          </div>
        ) : null}

        {activeTab === "register" ? (
          <label htmlFor="auth-name" className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
              Nombre
            </span>
            <input
              id="auth-name"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={isNameInvalid || undefined}
              aria-describedby={isNameInvalid ? AUTH_ERROR_ID : undefined}
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              placeholder="Tu nombre"
            />
          </label>
        ) : null}

        {activeTab === "login" ||
        activeTab === "register" ||
        activeTab === "forgot" ? (
          <label htmlFor="auth-email" className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
              Email
            </span>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={isEmailInvalid || undefined}
              aria-describedby={isEmailInvalid ? AUTH_ERROR_ID : undefined}
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              placeholder="vos@ejemplo.com"
            />
          </label>
        ) : null}

        {activeTab === "login" || activeTab === "register" ? (
          <label htmlFor="auth-password" className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
              Contraseña
            </span>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={
                activeTab === "login" ? "current-password" : "new-password"
              }
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={isPasswordInvalid || undefined}
              aria-describedby={isPasswordInvalid ? AUTH_ERROR_ID : undefined}
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              placeholder="Mínimo 8 caracteres"
            />
          </label>
        ) : null}

        {activeTab === "reset" ? (
          <>
            <label htmlFor="auth-new-password" className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Nueva contraseña
              </span>
              <input
                id="auth-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={isPasswordInvalid || undefined}
                aria-describedby={isPasswordInvalid ? AUTH_ERROR_ID : undefined}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
                placeholder="Mínimo 8 caracteres"
              />
            </label>
            <label
              htmlFor="auth-confirm-password"
              className="flex flex-col gap-1.5"
            >
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Confirmar contraseña
              </span>
              <input
                id="auth-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-invalid={isPasswordInvalid || undefined}
                aria-describedby={isPasswordInvalid ? AUTH_ERROR_ID : undefined}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              />
            </label>
          </>
        ) : null}

        {activeTab === "login" ? (
          <button
            type="button"
            onClick={() => {
              switchTab("forgot");
            }}
            className="text-left text-[13px] font-semibold text-[var(--ink-soft)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
        ) : null}

        {errorMessage ? (
          <p
            id={AUTH_ERROR_ID}
            className="text-[13px] text-[var(--red)]"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
        {statusMessage ? (
          <p
            id={AUTH_STATUS_ID}
            className="text-[13px] text-[var(--ink-soft)]"
            role="status"
          >
            {statusMessage}
          </p>
        ) : null}
        {devResetUrl ? (
          <p className="break-all text-[12px] text-[var(--ink-soft)]">
            Enlace de desarrollo:{" "}
            <a
              href={devResetUrl}
              className="font-semibold underline underline-offset-2"
            >
              abrir reset
            </a>
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--select)] text-[14px] font-bold text-[var(--chip-active-text)] transition-colors hover:brightness-110 disabled:opacity-50"
        >
          {isSubmitting ? "Esperá…" : submitLabel}
        </button>

        {activeTab === "forgot" || activeTab === "reset" ? (
          <button
            type="button"
            onClick={() => {
              switchTab("login");
            }}
            className="w-full text-center text-[13px] font-semibold text-[var(--ink-soft)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
          >
            Volver a iniciar sesión
          </button>
        ) : null}
      </form>
    </div>
  );
}
