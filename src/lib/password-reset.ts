import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function createResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildResetUrl(token: string): string {
  const base =
    process.env.AUTH_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000";
  return `${base}/?resetToken=${encodeURIComponent(token)}`;
}

/** Expose resetUrl in API responses for local/dev testing without SMTP. */
export function shouldExposeResetUrl(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.AUTH_DEV_RESET_URL === "1"
  );
}

/**
 * Best-effort email via Resend HTTP API (no npm package).
 * Returns true if a provider accepted the message.
 */
export async function trySendResetEmail(
  toEmail: string,
  resetUrl: string,
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return false;
  }

  const fromAddress =
    process.env.RESEND_FROM?.trim() || "OpenBalance <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toEmail],
        subject: "Restablecer contraseña — OpenBalance",
        text: [
          "Recibimos un pedido para restablecer tu contraseña en OpenBalance.",
          "",
          "Abrí este enlace (válido 1 hora):",
          resetUrl,
          "",
          "Si no pediste esto, ignorá el mensaje.",
        ].join("\n"),
        html: [
          "<p>Recibimos un pedido para restablecer tu contraseña en <strong>OpenBalance</strong>.</p>",
          `<p><a href="${resetUrl}">Restablecer contraseña</a> (válido 1 hora)</p>`,
          "<p>Si no pediste esto, ignorá el mensaje.</p>",
        ].join(""),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
