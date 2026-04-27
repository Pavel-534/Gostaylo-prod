'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminSystemPage } from '@/hooks/useAdminSystemPage'
import { SystemSettingsGeneral } from '@/components/admin/system/SystemSettingsGeneral'
import { SystemSettingsFinance } from '@/components/admin/system/SystemSettingsFinance'
import { SystemSettingsMarketing } from '@/components/admin/system/SystemSettingsMarketing'
import { SystemSettingsServices } from '@/components/admin/system/SystemSettingsServices'
import { SystemSettingsMaintenance } from '@/components/admin/system/SystemSettingsMaintenance'

export default function SystemControlPage() {
  const ctx = useAdminSystemPage()

  if (ctx.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4" />
          <p className="text-slate-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 lg:space-y-6 max-w-full overflow-hidden px-1">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-slate-100/90">
          <TabsTrigger value="general" className="text-xs sm:text-sm">
            Обзор
          </TabsTrigger>
          <TabsTrigger value="finance" className="text-xs sm:text-sm">
            Финансы
          </TabsTrigger>
          <TabsTrigger value="marketing" className="text-xs sm:text-sm">
            Маркетинг
          </TabsTrigger>
          <TabsTrigger value="services" className="text-xs sm:text-sm">
            Сервисы
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="text-xs sm:text-sm">
            Обслуживание
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <SystemSettingsGeneral maintenanceMode={ctx.maintenanceMode} webhookStatus={ctx.webhookStatus} />
        </TabsContent>

        <TabsContent value="finance" className="mt-4">
          <SystemSettingsFinance />
        </TabsContent>

        <TabsContent value="marketing" className="mt-4">
          <SystemSettingsMarketing />
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <SystemSettingsServices
            webhookStatus={ctx.webhookStatus}
            webhookLoading={ctx.webhookLoading}
            testingConnection={ctx.testingConnection}
            outboxStats={ctx.outboxStats}
            outboxWorkerLoading={ctx.outboxWorkerLoading}
            outboxLastResult={ctx.outboxLastResult}
            onRelinkWebhook={ctx.handleRelinkWebhook}
            onTestConnection={ctx.handleTestConnection}
            onSendAloha={ctx.handleSendAloha}
            onRefreshWebhook={ctx.checkWebhookStatus}
            onProcessOutbox={ctx.handleProcessNotificationOutbox}
            formatDate={ctx.formatDate}
          />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <SystemSettingsMaintenance
            maintenanceMode={ctx.maintenanceMode}
            onMaintenanceToggle={ctx.handleMaintenanceToggle}
            icalSyncStatus={ctx.icalSyncStatus}
            icalSyncFrequency={ctx.icalSyncFrequency}
            icalSyncing={ctx.icalSyncing}
            onGlobalIcalSync={ctx.handleGlobalIcalSync}
            onRefreshIcalStatus={ctx.loadIcalSyncStatus}
            onIcalFrequencyChange={ctx.handleIcalFrequencyChange}
            recentActivity={ctx.recentActivity}
            formatDate={ctx.formatDate}
            newPassword={ctx.newPassword}
            setNewPassword={ctx.setNewPassword}
            confirmPassword={ctx.confirmPassword}
            setConfirmPassword={ctx.setConfirmPassword}
            showNewPassword={ctx.showNewPassword}
            setShowNewPassword={ctx.setShowNewPassword}
            changingPassword={ctx.changingPassword}
            onPasswordChange={ctx.handlePasswordChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
