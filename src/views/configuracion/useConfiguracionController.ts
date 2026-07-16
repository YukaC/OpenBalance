"use client";

import { useEffect, useRef, useState } from "react";
import { downloadJsonFile, parseFinanceBackup } from "@/lib/backup";
import { parseTransactionsCsv } from "@/lib/csv-io";
import type { CurrencyCode } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/format";
import {
  clearPin,
  isPinEnabled,
  isValidPinFormat,
  setPin,
  verifyPin,
} from "@/lib/pin-lock";
import { initialsFromName } from "@/lib/profile-setup";
import { useFinanceStore } from "@/store/finance-store";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export type ConfigConfirmPending =
  | { kind: "restore" }
  | {
      kind: "removeAccount";
      accountId: string;
      accountName: string;
      transactionCount: number;
    }
  | { kind: "reset" };

export function useConfiguracionController() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const profile = useFinanceStore((s) => s.profile);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const accounts = useFinanceStore((s) => s.accounts);
  const updateProfile = useFinanceStore((s) => s.updateProfile);
  const setPayday = useFinanceStore((s) => s.setPayday);
  const resetToSeed = useFinanceStore((s) => s.resetToSeed);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const exportBackup = useFinanceStore((s) => s.exportBackup);
  const restoreBackup = useFinanceStore((s) => s.restoreBackup);
  const addAccount = useFinanceStore((s) => s.addAccount);
  const removeAccount = useFinanceStore((s) => s.removeAccount);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  const [pinError, setPinError] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountCurrency, setNewAccountCurrency] =
    useState<CurrencyCode>("ARS");
  const [pendingConfirm, setPendingConfirm] =
    useState<ConfigConfirmPending | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const pendingRestoreFileRef = useRef<File | null>(null);

  useEffect(() => {
    setName(profile.name);
  }, [profile.name]);

  useEffect(() => {
    setEmail(profile.email);
  }, [profile.email]);

  useEffect(() => {
    if (!hydrated) return;
    setPinEnabled(isPinEnabled());
  }, [hydrated]);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, [profile.shouldRemindPaydayLoad]);

  function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile.name) {
      setName(profile.name);
      return;
    }
    updateProfile({ name: trimmed, initials: initialsFromName(trimmed) });
  }

  function handleSaveEmail() {
    const trimmed = email.trim();
    if (!trimmed || trimmed === profile.email) {
      setEmail(profile.email);
      return;
    }
    if (!trimmed.includes("@")) {
      setEmail(profile.email);
      return;
    }
    updateProfile({ email: trimmed });
  }

  function handleExportCsv() {
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const sourceById = new Map(incomeSources.map((s) => [s.id, s.name]));
    const header = [
      "fecha",
      "tipo",
      "titulo",
      "monto",
      "moneda",
      "metodo",
      "categoria",
      "fuente",
      "nota",
      "mes",
      "semana",
    ];
    const rows = [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((tx) =>
        [
          tx.date,
          tx.type,
          tx.title,
          String(tx.amount),
          tx.currency,
          METHOD_LABELS[tx.method] ?? tx.method,
          tx.categoryId ? (categoryById.get(tx.categoryId) ?? "") : "",
          tx.incomeSourceId ? (sourceById.get(tx.incomeSourceId) ?? "") : "",
          tx.note,
          tx.month,
          tx.weekIso,
        ]
          .map(escapeCsv)
          .join(","),
      );

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rinde-movimientos-${profile.defaultCurrency.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportCsv(file: File | undefined) {
    if (!file) return;
    setImportMessage(null);
    try {
      const text = await file.text();
      const { rows, skippedCount } = parseTransactionsCsv(
        text,
        categories,
        incomeSources,
        profile.defaultCurrency,
      );
      const existingKeys = new Set(
        transactions.map(
          (tx) =>
            `${tx.date}|${tx.amount}|${tx.title.trim().toLowerCase()}`,
        ),
      );
      let importedCount = 0;
      let duplicateCount = 0;
      for (const row of rows) {
        const key = `${row.date}|${row.amount}|${row.title.trim().toLowerCase()}`;
        if (existingKeys.has(key)) {
          duplicateCount += 1;
          continue;
        }
        addTransaction({
          type: row.type,
          amount: row.amount,
          date: row.date,
          method: row.method,
          categoryId: row.categoryId,
          incomeSourceId: row.incomeSourceId,
          note: row.note,
          title: row.title,
          currency: row.currency,
          origin: row.origin,
        });
        existingKeys.add(key);
        importedCount += 1;
      }
      const parts = [`Se importaron ${importedCount} movimientos.`];
      if (duplicateCount > 0) {
        parts.push(`Se omitieron ${duplicateCount} duplicados.`);
      }
      if (skippedCount > 0) {
        parts.push(`Se omitieron ${skippedCount} filas inválidas.`);
      }
      setImportMessage(parts.join(" "));
    } catch {
      setImportMessage("No se pudo leer el CSV.");
    }
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  function handleExportBackup() {
    const payload = exportBackup();
    downloadJsonFile(
      `rinde-respaldo-${payload.exportedAt.slice(0, 10)}.json`,
      payload,
    );
  }

  async function handleRestoreBackup(file: File | undefined) {
    if (!file) return;
    pendingRestoreFileRef.current = file;
    setPendingConfirm({ kind: "restore" });
  }

  function handleRemoveAccount(accountId: string, accountName: string) {
    const transactionCount = transactions.filter(
      (tx) => tx.accountId === accountId,
    ).length;
    setPendingConfirm({
      kind: "removeAccount",
      accountId,
      accountName,
      transactionCount,
    });
  }

  function handleAddAccount(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = newAccountName.trim();
    if (!trimmed) return;
    addAccount({ name: trimmed, currency: newAccountCurrency });
    setNewAccountName("");
    setNewAccountCurrency(profile.defaultCurrency);
  }

  function handleReset() {
    setPendingConfirm({ kind: "reset" });
  }

  function cancelConfirm() {
    if (pendingConfirm?.kind === "restore") {
      pendingRestoreFileRef.current = null;
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
    setPendingConfirm(null);
  }

  async function confirmPending() {
    if (!pendingConfirm) return;
    const pending = pendingConfirm;
    setPendingConfirm(null);

    if (pending.kind === "restore") {
      const file = pendingRestoreFileRef.current;
      pendingRestoreFileRef.current = null;
      if (!file) return;
      try {
        const text = await file.text();
        const payload = parseFinanceBackup(text);
        if (!payload) {
          setImportMessage("El archivo no es un respaldo válido de Rinde.");
          return;
        }
        restoreBackup(payload);
        setImportMessage("Respaldo restaurado correctamente.");
      } catch {
        setImportMessage("No se pudo leer el respaldo.");
      } finally {
        if (backupInputRef.current) backupInputRef.current.value = "";
      }
      return;
    }

    if (pending.kind === "removeAccount") {
      removeAccount(pending.accountId);
      return;
    }

    resetToSeed();
    setName("Mariano J.");
    setEmail("mariano@example.com");
    setImportMessage(null);
  }

  async function handleSavePin() {
    setPinError("");
    setPinMessage("");
    if (!isValidPinFormat(newPin)) {
      setPinError("El PIN debe tener entre 4 y 6 dígitos.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("Los PIN no coinciden.");
      return;
    }
    if (pinEnabled) {
      const isCurrentValid = await verifyPin(currentPin);
      if (!isCurrentValid) {
        setPinError("PIN actual incorrecto.");
        return;
      }
    }
    setIsSavingPin(true);
    try {
      await setPin(newPin);
      setPinEnabled(true);
      setNewPin("");
      setConfirmPin("");
      setCurrentPin("");
      setPinMessage(pinEnabled ? "PIN actualizado." : "PIN activado.");
    } finally {
      setIsSavingPin(false);
    }
  }

  async function handleDisablePin() {
    setPinError("");
    setPinMessage("");
    if (!isValidPinFormat(currentPin)) {
      setPinError("Ingresá el PIN actual (4–6 dígitos) para desactivarlo.");
      return;
    }
    const isCurrentValid = await verifyPin(currentPin);
    if (!isCurrentValid) {
      setPinError("PIN actual incorrecto.");
      return;
    }
    clearPin();
    setPinEnabled(false);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinMessage("PIN desactivado.");
  }

  async function handleTogglePaydayReminder(nextEnabled: boolean) {
    if (nextEnabled && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      } else {
        setNotificationPermission(Notification.permission);
      }
    }
    updateProfile({ shouldRemindPaydayLoad: nextEnabled });
  }

  return {
    hydrated,
    profile,
    accounts,
    name,
    setName,
    email,
    setEmail,
    pinEnabled,
    newPin,
    setNewPin,
    confirmPin,
    setConfirmPin,
    currentPin,
    setCurrentPin,
    pinMessage,
    pinError,
    isSavingPin,
    notificationPermission,
    importMessage,
    newAccountName,
    setNewAccountName,
    newAccountCurrency,
    setNewAccountCurrency,
    csvInputRef,
    backupInputRef,
    updateProfile,
    setPayday,
    handleSaveName,
    handleSaveEmail,
    handleExportCsv,
    handleImportCsv,
    handleExportBackup,
    handleRestoreBackup,
    handleRemoveAccount,
    handleAddAccount,
    handleReset,
    pendingConfirm,
    confirmPending,
    cancelConfirm,
    handleSavePin,
    handleDisablePin,
    handleTogglePaydayReminder,
  };
}
