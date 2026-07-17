"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ViewSkeleton } from "@/components/ViewSkeleton";
import type { CurrencyCode } from "@/lib/format";
import { AccountSecuritySection } from "@/views/configuracion/AccountSecuritySection";
import { AccountsSection } from "@/views/configuracion/AccountsSection";
import { DataSection } from "@/views/configuracion/DataSection";
import { DownloadAppSection } from "@/views/configuracion/DownloadAppSection";
import { ImportPdfSection } from "@/views/configuracion/ImportPdfSection";
import { PaydaySection } from "@/views/configuracion/PaydaySection";
import { PinSection } from "@/views/configuracion/PinSection";
import { ProfileSection } from "@/views/configuracion/ProfileSection";
import { SyncSection } from "@/views/configuracion/SyncSection";
import {
  useConfiguracionController,
  type ConfigConfirmPending,
} from "@/views/configuracion/useConfiguracionController";

function getConfirmDialogCopy(pending: ConfigConfirmPending) {
  if (pending.kind === "restore") {
    return {
      title: "Restaurar respaldo",
      message:
        "¿Restaurar respaldo? Se reemplazan perfil, categorías, movimientos, presupuestos y cuentas.",
      confirmLabel: "Restaurar",
      isDestructive: true,
    };
  }
  if (pending.kind === "removeAccount") {
    const { accountName, transactionCount } = pending;
    const message =
      transactionCount > 0
        ? `¿Quitar la cuenta «${accountName}»? Hay ${transactionCount} ${transactionCount === 1 ? "movimiento asociado" : "movimientos asociados"}; quedarán sin cuenta.`
        : `¿Quitar la cuenta «${accountName}»?`;
    return {
      title: "Quitar cuenta",
      message,
      confirmLabel: "Quitar",
      isDestructive: true,
    };
  }
  return {
    title: "Restablecer datos demo",
    message:
      "¿Restablecer datos de demostración? Se reemplazan perfil, categorías y movimientos. El perfil demo (Mariano) queda con setup completo y no vuelve a pedir onboarding.",
    confirmLabel: "Restablecer",
    isDestructive: true,
  };
}

export default function ConfiguracionView() {
  const controller = useConfiguracionController();
  const confirmCopy = controller.pendingConfirm
    ? getConfirmDialogCopy(controller.pendingConfirm)
    : null;

  if (!controller.hydrated) {
    return <ViewSkeleton />;
  }

  return (
    <div className="view-stack">
      <header className="page-header">
        <h1 className="page-title">Configuración</h1>
        <p className="page-lede">La semana primero, el mes como contexto</p>
      </header>

      <ProfileSection
        profile={controller.profile}
        name={controller.name}
        setName={controller.setName}
        email={controller.email}
        setEmail={controller.setEmail}
        onSaveName={controller.handleSaveName}
        onSaveEmail={controller.handleSaveEmail}
        onCurrencyChange={(currency: CurrencyCode) =>
          controller.updateProfile({ defaultCurrency: currency })
        }
        onSavingsGoalChange={(goal) =>
          controller.updateProfile({ monthlySavingsGoal: goal })
        }
        onManualExchangeRateChange={(rate) =>
          controller.updateProfile({ manualExchangeRate: rate })
        }
      />

      <AccountsSection
        profile={controller.profile}
        accounts={controller.accounts}
        transactions={controller.transactions}
        newAccountName={controller.newAccountName}
        setNewAccountName={controller.setNewAccountName}
        newAccountCurrency={controller.newAccountCurrency}
        setNewAccountCurrency={controller.setNewAccountCurrency}
        onAddAccount={controller.handleAddAccount}
        onRemoveAccount={controller.handleRemoveAccount}
        onSetDefaultAccount={(accountId) =>
          controller.updateProfile({ defaultAccountId: accountId })
        }
        transferFromAccountId={controller.transferFromAccountId}
        setTransferFromAccountId={controller.setTransferFromAccountId}
        transferToAccountId={controller.transferToAccountId}
        setTransferToAccountId={controller.setTransferToAccountId}
        transferAmount={controller.transferAmount}
        setTransferAmount={controller.setTransferAmount}
        transferDate={controller.transferDate}
        setTransferDate={controller.setTransferDate}
        onAddTransfer={controller.handleAddTransfer}
      />

      <PaydaySection
        profile={controller.profile}
        notificationPermission={controller.notificationPermission}
        onSetPayday={controller.setPayday}
        onTogglePaydayReminder={controller.handleTogglePaydayReminder}
      />

      <PinSection
        pinEnabled={controller.pinEnabled}
        currentPin={controller.currentPin}
        setCurrentPin={controller.setCurrentPin}
        newPin={controller.newPin}
        setNewPin={controller.setNewPin}
        confirmPin={controller.confirmPin}
        setConfirmPin={controller.setConfirmPin}
        pinError={controller.pinError}
        pinMessage={controller.pinMessage}
        isSavingPin={controller.isSavingPin}
        onSavePin={controller.handleSavePin}
        onDisablePin={controller.handleDisablePin}
        canUseBiometric={controller.canUseBiometric}
        biometricEnabled={controller.biometricEnabled}
        isTogglingBiometric={controller.isTogglingBiometric}
        onToggleBiometric={controller.handleToggleBiometric}
      />

      <SyncSection />

      <AccountSecuritySection />

      <DataSection
        csvInputRef={controller.csvInputRef}
        backupInputRef={controller.backupInputRef}
        importMessage={controller.importMessage}
        onExportCsv={controller.handleExportCsv}
        onImportCsv={controller.handleImportCsv}
        onExportBackup={controller.handleExportBackup}
        onRestoreBackup={controller.handleRestoreBackup}
        onReset={controller.handleReset}
      />

      <ImportPdfSection />

      <DownloadAppSection />

      <ConfirmDialog
        isOpen={Boolean(confirmCopy)}
        title={confirmCopy?.title ?? ""}
        message={confirmCopy?.message ?? ""}
        confirmLabel={confirmCopy?.confirmLabel}
        isDestructive={confirmCopy?.isDestructive}
        onConfirm={() => {
          void controller.confirmPending();
        }}
        onCancel={controller.cancelConfirm}
      />
    </div>
  );
}
