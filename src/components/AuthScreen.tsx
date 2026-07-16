"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { getApiBaseUrl } from "@/lib/auth-flags";

type AuthTab = "login" | "register";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API_BASE = getApiBaseUrl();

export function AuthScreen() {
  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error === "Email already registered") {
          message = "Ese email ya está registrado.";
        } else if (payload.error === "Password must be at least 8 characters") {
          message = "La contraseña debe tener al menos 8 caracteres.";
        } else if (payload.error === "Invalid email") {
          message = "Ingresá un email válido.";
        } else if (payload.error === "Name is required") {
          message = "Ingresá tu nombre para continuar.";
        } else if (payload.error === "Database unavailable") {
          message = "El servidor no está disponible todavía.";
        } else if (payload.error) {
          message = payload.error;
        }
      } catch {
        /* ignore */
      }
      setErrorMessage(message);
      return false;
    }
    return true;
  }

  async function handleCredentialsSignIn(): Promise<boolean> {
    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setErrorMessage(
        activeTab === "login"
          ? "Email o contraseña incorrectos."
          : "Cuenta creada, pero no se pudo iniciar sesión.",
      );
      return false;
    }
    return true;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMessage("Ingresá un email válido.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (activeTab === "register" && !trimmedName) {
      setErrorMessage("Ingresá tu nombre para continuar.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      if (activeTab === "register") {
        const registered = await handleRegister();
        if (!registered) return;
      }
      await handleCredentialsSignIn();
    } catch {
      setErrorMessage(
        "No se pudo conectar con el servidor. Revisá tu conexión.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[var(--bg)] px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="ledger-panel w-full max-w-sm space-y-5 p-6 sm:p-8"
        aria-labelledby="auth-heading"
      >
        <header className="space-y-2 text-center">
          <p className="font-display text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            Rinde
          </p>
          <h1
            id="auth-heading"
            className="font-display text-[20px] font-semibold text-[var(--ink)]"
          >
            {activeTab === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </h1>
          <p className="text-[14px] text-[var(--ink-soft)]">
            Sincronizá tus datos entre dispositivos. La app sigue funcionando
            sin conexión.
          </p>
        </header>

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
              setActiveTab("login");
              setErrorMessage("");
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
              setActiveTab("register");
              setErrorMessage("");
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
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              placeholder="Tu nombre"
            />
          </label>
        ) : null}

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
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            placeholder="vos@ejemplo.com"
          />
        </label>

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
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            placeholder="Mínimo 8 caracteres"
          />
        </label>

        {errorMessage ? (
          <p className="text-[13px] text-[var(--red)]" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--select)] text-[14px] font-bold text-[var(--chip-active-text)] transition-colors hover:brightness-110 disabled:opacity-50"
        >
          {isSubmitting
            ? "Esperá…"
            : activeTab === "login"
              ? "Entrar"
              : "Crear cuenta"}
        </button>
      </form>
    </div>
  );
}
