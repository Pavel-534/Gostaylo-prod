'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  Banknote,
  Bell,
  BookOpen,
  Download,
  FileStack,
  Info,
  LayoutDashboard,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FINTECH_MINT } from '@/lib/admin/fintech-console-shared'
import { useAdminFinTechConsole } from '@/hooks/useAdminFinTechConsole'
import { FinTechConsoleHeader } from '@/components/admin/finances/FinTechConsoleHeader'
import {
  TestDataToolbar,
  persistFintechOwnerModePreference,
  persistFintechRealDataOnlyPreference,
} from '@/components/admin/finances/TestDataToolbar'
import { LaunchReadinessCard } from '@/components/admin/finances/LaunchReadinessCard'
import { PreLiveReadinessCard } from '@/components/admin/finances/PreLiveReadinessCard'
import { ControlledLivePanel } from '@/components/admin/finances/ControlledLivePanel'
import { FinTechCronHealthPanel } from '@/components/admin/finances/FinTechCronHealthPanel'
import { FinTechTreasuryHeroDashboard } from '@/components/admin/finances/FinTechTreasuryHeroDashboard'
import { FinTechEmergencyPauseCard } from '@/components/admin/finances/FinTechEmergencyPauseCard'
import { FinTechOverviewDashboard } from '@/components/admin/finances/FinTechOverviewDashboard'
import { PayoutBatchesPanel } from '@/components/admin/finances/PayoutBatchesPanel'
import { ConversionsPanel } from '@/components/admin/finances/ConversionsPanel'
import { FinTechTreasuryMonitoringPanel } from '@/components/admin/finances/FinTechTreasuryMonitoringPanel'
import { MovementsJournal } from '@/components/admin/finances/MovementsJournal'
import { FinTechExportsPanel } from '@/components/admin/finances/FinTechExportsPanel'
import { FiscalSandboxReceiptDialog } from '@/components/admin/finances/FiscalSandboxReceiptDialog'
import { ReferralLiabilityPanel } from '@/components/admin/finances/ReferralLiabilityPanel'

/**
 * Stage 109.0 — FinTech-пульт: композиция панелей (логика в useAdminFinTechConsole).
 */
export function AdminFinTechConsole() {
  const c = useAdminFinTechConsole()

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-surface to-white">
      <FinTechConsoleHeader
        dash={c.dash}
        statCards={c.statCards}
        loading={c.loading}
        onRefresh={c.load}
        liveMonitoring={c.liveMonitoring}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <TestDataToolbar
          realDataOnly={c.realDataOnly}
          onRealDataOnlyChange={(v) => {
            c.setRealDataOnly(v)
            persistFintechRealDataOnlyPreference(v)
          }}
          ownerMode={c.ownerMode}
          onOwnerModeChange={(v) => {
            c.setOwnerMode(v)
            persistFintechOwnerModePreference(v)
          }}
          onCleaned={c.handleTestDataCleaned}
        />

        <Card
          className="border-brand/25 bg-brand/10 shadow-sm"
          title="Все суммы на пульте — для гостя (включая сервисный сбор)"
        >
          <CardContent className="py-3 flex items-start gap-2 text-sm text-brand">
            <Info className="h-4 w-4 shrink-0 text-brand-hover mt-0.5" aria-hidden />
            <p>
              <span className="font-semibold">Подсказка:</span> суммы на этом пульте показаны так, как
              их видит гость — с учётом сервисного сбора, если не указано иное.
            </p>
          </CardContent>
        </Card>

        <LaunchReadinessCard readiness={c.productionReadiness} onRefresh={c.load} />
        <PreLiveReadinessCard
          preLiveReadiness={c.preLiveReadiness}
          cronHealth={c.cronHealth}
          onRefresh={c.load}
        />
        <ControlledLivePanel
          liveMonitoring={c.liveMonitoring}
          treasuryOps={c.treasuryOps}
          onRefresh={c.load}
        />
        <ReferralLiabilityPanel toast={c.toast} />
        <FinTechCronHealthPanel cronHealth={c.cronHealth} ownerMode={c.ownerMode} loading={c.loading} />
        <FinTechTreasuryHeroDashboard
          dash={c.dash}
          statCards={c.statCards}
          onSimulateRail={c.ownerMode ? undefined : c.simulateFinancialRail}
          ownerMode={c.ownerMode}
        />
        <FinTechEmergencyPauseCard ops={c.treasuryOps} onUpdated={c.load} toast={c.toast} />

        <Card className="border-amber-200 bg-amber-50/90 shadow-sm">
          <CardContent className="py-4 flex flex-wrap items-start gap-3 text-sm text-amber-950">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Режим Concierge Launch (ручной)</p>
              <p className="mt-1 text-amber-900/90">
                Это ручной режим Concierge Launch: автоматизация банковских выплат будет позже. Вы
                сами формируете пул, скачиваете CSV/ZIP для банка, переводите деньги и отмечаете пул
                оплаченным. PDF-акты партнёрам создаются при закрытии пула.
              </p>
              <Link
                href="/admin/settings/legal"
                className="inline-block mt-2 text-brand-hover font-medium underline"
              >
                Юридические документы и версии оферты
              </Link>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              Обзор
            </TabsTrigger>
            <TabsTrigger value="pools" className="gap-1.5">
              <FileStack className="h-4 w-4" />
              Пулы
            </TabsTrigger>
            <TabsTrigger value="conversions" className="gap-1.5">
              <Banknote className="h-4 w-4" />
              Конвертации
            </TabsTrigger>
            {!c.ownerMode && (
              <TabsTrigger value="monitoring" className="gap-1.5">
                <Bell className="h-4 w-4" />
                Мониторинг
              </TabsTrigger>
            )}
            <TabsTrigger value="journal" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              {c.ownerMode ? 'История' : 'Журнал'}
            </TabsTrigger>
            {!c.ownerMode && (
              <TabsTrigger value="exports" className="gap-1.5">
                <Download className="h-4 w-4" />
                Выгрузки
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <FinTechOverviewDashboard
              ownerMode={c.ownerMode}
              dash={c.dash}
              loading={c.loading}
              v2Effective={c.v2Effective}
              v2EnvLock={c.v2EnvLock}
              setV2Pending={c.setV2Pending}
              setV2DialogOpen={c.setV2DialogOpen}
              fiscalSandbox={c.fiscalSandbox}
              fiscalTestLoading={c.fiscalTestLoading}
              runFiscalTest={c.runFiscalTest}
              retryFiscal={c.retryFiscal}
              simSubtotal={c.simSubtotal}
              setSimSubtotal={c.setSimSubtotal}
              simProfileId={c.simProfileId}
              setSimProfileId={c.setSimProfileId}
              runSimulate={c.runSimulate}
              simResult={c.simResult}
              activeProfiles={c.activeProfiles}
              archivedProfiles={c.archivedProfiles}
              draft={c.draft}
              setDraft={c.setDraft}
              editingId={c.editingId}
              setEditingId={c.setEditingId}
              draftValid={c.draftValid}
              saveProfile={c.saveProfile}
              archiveProfile={c.archiveProfile}
              monthMargin={c.monthMargin}
              driftBad={c.driftBad}
              lastRecon={c.lastRecon}
              reconLoading={c.reconLoading}
              runReconcile={c.runReconcile}
            />
          </TabsContent>

          <TabsContent value="pools" className="mt-0">
            <PayoutBatchesPanel
              ownerMode={c.ownerMode}
              dash={c.dash}
              poolRail={c.poolRail}
              setPoolRail={c.setPoolRail}
              batchRailFilter={c.batchRailFilter}
              setBatchRailFilter={c.setBatchRailFilter}
              visibleBatches={c.visibleBatches}
              settlingBatchId={c.settlingBatchId}
              createPool={c.createPool}
              lockBatch={c.lockBatch}
              exportBatch={c.exportBatch}
              downloadBankPackage={c.downloadBankPackage}
              markBatchPaid={c.markBatchPaid}
            />
          </TabsContent>

          <TabsContent value="conversions" className="mt-0">
            <ConversionsPanel excludeTest={c.realDataOnly} refreshKey={c.dataRefreshKey} />
          </TabsContent>

          <TabsContent value="monitoring" className="mt-0">
            <FinTechTreasuryMonitoringPanel />
          </TabsContent>

          <TabsContent value="journal" className="mt-0">
            <MovementsJournal
              excludeTest={c.realDataOnly}
              ownerSimple={c.ownerMode}
              refreshKey={c.dataRefreshKey}
            />
          </TabsContent>

          <TabsContent value="exports" className="mt-0">
            <FinTechExportsPanel
              monthlyExporting={c.monthlyExporting}
              exportMonthBundle={c.exportMonthBundle}
              complianceBooking={c.complianceBooking}
              setComplianceBooking={c.setComplianceBooking}
              complianceFrom={c.complianceFrom}
              setComplianceFrom={c.setComplianceFrom}
              complianceTo={c.complianceTo}
              setComplianceTo={c.setComplianceTo}
              complianceDownloading={c.complianceDownloading}
              downloadCompliance={c.downloadCompliance}
            />
          </TabsContent>
        </Tabs>
      </div>

      <FiscalSandboxReceiptDialog
        open={c.fiscalTestOpen}
        onOpenChange={c.setFiscalTestOpen}
        display={c.fiscalTestDisplay}
      />

      <AlertDialog open={c.v2DialogOpen} onOpenChange={c.setV2DialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {c.v2Pending ? 'Включить новый движок цен?' : 'Выключить новый движок цен?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {c.v2Pending
                ? 'Новые брони: округление до 1 ฿, полная схема комиссий и чеки. Убедитесь, что касса в нужном режиме (тест/бой).'
                : 'Новые брони вернутся к прежней схеме. Уже созданные брони не изменятся.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => c.setV2Pending(null)}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={c.applyV2Toggle} style={{ backgroundColor: FINTECH_MINT }}>
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
