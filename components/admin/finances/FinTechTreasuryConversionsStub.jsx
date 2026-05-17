'use client'

import { ArrowRightLeft, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

const MINT = '#0D9488'
const NAVY = '#0F172A'

/**
 * Stage 101 placeholder — manual FX conversion / loss journal (Concierge).
 */
export function FinTechTreasuryConversionsStub() {
  const { toast } = useToast()

  return (
    <Card
      className="shadow-sm overflow-hidden border-2 border-dashed"
      style={{ borderColor: `${MINT}55`, background: 'linear-gradient(135deg, #f0fdfa 0%, #f8fafc 100%)' }}
    >
      <CardHeader className="pb-2" style={{ borderLeft: `4px solid ${MINT}` }}>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
            <ArrowRightLeft className="h-5 w-5" style={{ color: MINT }} />
            Конвертации и потери
          </CardTitle>
          <Badge className="bg-teal-100 text-teal-900 hover:bg-teal-100">Следующий этап — Stage 101</Badge>
        </div>
        <CardDescription className="text-slate-700">
          Здесь будет журнал ручного обмена рублей в баты при переводе в банк: фактический курс, комиссия банка и
          курсовые потери. Сейчас фиксируйте операции во внешней таблице; после Stage 101 записи привяжем к пулу
          выплат.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 rounded-lg border border-teal-200 bg-white/80 px-3 py-2 text-sm text-slate-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: MINT }} />
          <p>
            Пример: перевели 1 000 000 ₽ в банк, получили ฿380 000 по курсу — разница со спредом в брони пойдёт в
            этот журнал для бухгалтерии.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 opacity-70">
          <div>
            <Label className="text-xs">Дата операции</Label>
            <Input type="date" disabled />
          </div>
          <div>
            <Label className="text-xs">Сумма (₽)</Label>
            <Input placeholder="0,00" disabled />
          </div>
          <div>
            <Label className="text-xs">Курс фактический (бат за 1 ₽)</Label>
            <Input placeholder="0,00" disabled />
          </div>
          <div>
            <Label className="text-xs">Потери / спред (₽)</Label>
            <Input placeholder="0,00" disabled />
          </div>
        </div>
        <Button
          variant="outline"
          className="border-teal-300 text-teal-900 hover:bg-teal-50"
          onClick={() =>
            toast({
              title: 'Раздел в разработке',
              description:
                'Stage 101: сохранение конвертаций в учётной книге и привязка к пулу выплат появится в следующем релизе.',
            })
          }
        >
          Сохранить запись (пока недоступно)
        </Button>
      </CardContent>
    </Card>
  )
}
