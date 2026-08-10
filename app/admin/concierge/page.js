'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConciergeImportTab } from '@/components/admin/concierge/ConciergeImportTab'
import { ConciergeBatchesTab } from '@/components/admin/concierge/ConciergeBatchesTab'

export default function AdminConciergePage() {
  return (
    <div className="space-y-4 sm:space-y-6" data-testid="admin-concierge-page">
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
          Concierge Supply
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Подготовка пакетов из PDF/Excel/Sheets: промпт → JSON → валидация → ingest → claim для
          нового партнёра. Без изменения fee/FX и без нового listing FSM.
        </p>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-auto min-h-[44px]">
          <TabsTrigger value="import" className="min-h-[44px]" data-testid="concierge-tab-import">
            Импорт объектов
          </TabsTrigger>
          <TabsTrigger value="batches" className="min-h-[44px]" data-testid="concierge-tab-batches">
            Журнал батчей
          </TabsTrigger>
        </TabsList>
        <TabsContent value="import" className="mt-4">
          <ConciergeImportTab />
        </TabsContent>
        <TabsContent value="batches" className="mt-4">
          <ConciergeBatchesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
