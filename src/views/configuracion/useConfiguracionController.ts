"use client";

import { useEffect, useRef, useState } from "react";
import { downloadJsonFile, parseFinanceBackup } from "@/lib/backup";
import {
  disableBiometricUnlock,
  enableBiometricUnlock,
  isBiometricHardwareAvailable,
  isBiometricUnlockEnabled,
} from "@/lib/biometric-unlock";
import { parseTransactionsCsv, buildTransactionsCsv } from "@/lib/csv-io";
import { isRunningInNativeApp } from "@/lib/device";
import { isActive } from "@/lib/entity-lifecycle";
import { todayIso } from "@/lib/dates";
import type { CurrencyCode } from "@/lib/format";
import { METHOD_LABELS, parseMoneyInput } from "@/lib/format";
import {
  requestNativePaydayPermission,
  syncNativePaydayNotification,
} from "@/lib/payday-reminder";
import {
  disablePinWithVerification,
  isPinEnabled,
  isValidPinFormat,
  setPin,
  verifyPin,
} from "@/lib/pin-lock";
import { initialsFromName } from "@/lib/profile-setup";
import { touchFinancePersist, useFinanceStore } from "@/store/finance-store";

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
  const addTransfer = useFinanceStore((s) => s.addTransfer);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  const [pinError, setPinError] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isTogglingBiometric, setIsTogglingBiometric] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountCurrency, setNewAccountCurrency] =
    useState<CurrencyCode>("ARS");
  const [transferFromAccountId, setTransferFromAccountId] = useState("");
  const [transferToAccountId, setTransferToAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState(todayIso());
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
    const active = accounts.filter(isActive);
    if (active.length === 0) return;
    if (!active.some((account) => account.id === transferFromAccountId)) {
      setTransferFromAccountId(active[0].id);
    }
    if (!active.some((account) => account.id === transferToAccountId)) {
      const fallback =
        active.find((account) => account.id !== transferFromAccountId) ??
        active[0];
      setTransferToAccountId(fallback.id);
    }
  }, [accounts, transferFromAccountId, transferToAccountId]);

  useEffect(() => {
    if (!hydrated) return;
    setPinEnabled(isPinEnabled());
    let isCancelled = false;
    async function refreshBiometric() {
      if (!isRunningInNativeApp()) return;
      const [isAvailable, isEnabled] = await Promise.all([
        isBiometricHardwareAvailable(),
        isBiometricUnlockEnabled(),
      ]);
      if (isCancelled) return;
      setCanUseBiometric(isAvailable);
      setBiometricEnabled(isEnabled);
    }
    void refreshBiometric();
    return () => {
      isCancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void syncNativePaydayNotification(
      profile.paydayWeekday,
      Boolean(profile.shouldRemindPaydayLoad),
    );
  }, [hydrated, profile.paydayWeekday, profile.shouldRemindPaydayLoad]);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      if (isRunningInNativeApp()) {
        setNotificationPermission("default");
      } else {
        setNotificationPermission("unsupported");
      }
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
    const csv = buildTransactionsCsv(
      transactions,
      categoryById,
      sourceById,
      METHOD_LABELS,
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `openbalance-movimientos-${profile.defaultCurrency.toLowerCase()}.csv`;
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

  async function handleExportBackup() {
    const payload = exportBackup();
    await downloadJsonFile(
      `openbalance-respaldo-${payload.exportedAt.slice(0, 10)}.json`,
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
      (tx) => isActive(tx) && tx.accountId === accountId,
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

  function handleAddTransfer(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseMoneyInput(transferAmount);
    if (
      !(amount > 0) ||
      !transferFromAccountId ||
      !transferToAccountId ||
      transferFromAccountId === transferToAccountId
    ) {
      return;
    }
    addTransfer({
      fromAccountId: transferFromAccountId,
      toAccountId: transferToAccountId,
      amount,
      date: transferDate || todayIso(),
    });
    setTransferAmount("");
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
          setImportMessage("El archivo no es un respaldo válido de OpenBalance.");
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
      // setPin loads session key — rewrite finance blob as ciphertext.
      touchFinancePersist();
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
    const didDisable = await disablePinWithVerification(currentPin);
    if (!didDisable) {
      setPinError("PIN actual incorrecto.");
      return;
    }
    await disableBiometricUnlock();
    setBiometricEnabled(false);
    // Session key cleared — next persist write stores plaintext.
    touchFinancePersist();
    setPinEnabled(false);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinMessage("PIN desactivado.");
  }

  async function handleToggleBiometric(nextEnabled: boolean) {
    setPinError("");
    setPinMessage("");
    if (!pinEnabled) {
      setPinError("Activá un PIN antes de usar biometría.");
      return;
    }
    setIsTogglingBiometric(true);
    try {
      if (!nextEnabled) {
        await disableBiometricUnlock();
        setBiometricEnabled(false);
        setPinMessage("Biometría desactivada.");
        return;
      }
      if (!isValidPinFormat(currentPin)) {
        setPinError("Ingresá el PIN actual para activar biometría.");
        return;
      }
      const isCurrentValid = await verifyPin(currentPin);
      if (!isCurrentValid) {
        setPinError("PIN actual incorrecto.");
        return;
      }
      const didEnable = await enableBiometricUnlock(currentPin);
      if (!didEnable) {
        setPinError("No se pudo activar biometría en este dispositivo.");
        return;
      }
      setBiometricEnabled(true);
      setCurrentPin("");
      setPinMessage("Biometría activada. Podés desbloquear sin tipear el PIN.");
    } finally {
      setIsTogglingBiometric(false);
    }
  }

  async function handleTogglePaydayReminder(nextEnabled: boolean) {
    if (nextEnabled) {
      if (isRunningInNativeApp()) {
        const granted = await requestNativePaydayPermission();
        setNotificationPermission(granted ? "granted" : "denied");
      } else if (typeof Notification !== "undefined") {
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          setNotificationPermission(permission);
        } else {
          setNotificationPermission(Notification.permission);
        }
      }
    }
    updateProfile({ shouldRemindPaydayLoad: nextEnabled });
    await syncNativePaydayNotification(profile.paydayWeekday, nextEnabled);
  }

  return {
    hydrated,
    profile,
    accounts: accounts.filter(isActive),
    transactions,
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
    canUseBiometric,
    biometricEnabled,
    isTogglingBiometric,
    notificationPermission,
    importMessage,
    newAccountName,
    setNewAccountName,
    newAccountCurrency,
    setNewAccountCurrency,
    transferFromAccountId,
    setTransferFromAccountId,
    transferToAccountId,
    setTransferToAccountId,
    transferAmount,
    setTransferAmount,
    transferDate,
    setTransferDate,
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
    handleAddTransfer,
    handleReset,
    pendingConfirm,
    confirmPending,
    cancelConfirm,
    handleSavePin,
    handleDisablePin,
    handleToggleBiometric,
    handleTogglePaydayReminder,
  };
}
