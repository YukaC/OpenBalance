export type LogFields = {
  event: string;
  message: string;
  userId?: string;
  code?: string;
};

type LogLevel = "info" | "error";

function writeLog(level: LogLevel, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    event: fields.event,
    message: fields.message,
    ...(fields.userId ? { userId: fields.userId } : {}),
    ...(fields.code ? { code: fields.code } : {}),
  });
  if (level === "error") {
    console.error(line);
    return;
  }
  console.info(line);
}

/** Structured one-line JSON info log (no Sentry). */
export function logInfo(fields: LogFields): void {
  writeLog("info", fields);
}

/** Structured one-line JSON error log (no Sentry). */
export function logError(fields: LogFields): void {
  writeLog("error", fields);
}
