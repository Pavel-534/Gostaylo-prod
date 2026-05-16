'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Download, Lock, Play, RefreshCw } from 'lucide-react'

const emptyProfile = {
  id: '',
  name: '',
  guest_fee_pct: 15,
  host_fee_pct: 0,
  fx_markup_pct: 3,
  ru_agent_share_pct: 7,
  kr_service_share_pct: 8,
  insurance_fund_pct: 0,
  tax_rate_pct: 0,
  is_active: true,
}

export default function AdminFinTechSettingsPage() {
  const { toast } = useToast()
  const [profiles, setProfiles] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [simSubtotal, setSimSubtotal] = useState('10000')
  const [simProfileId, setSimProfileId] = useState('')
  const [simResult, setSimResult] = useState(null)
  const [complianceId, setComplianceId] = useState('')
  const [compliance, setCompliance] = useState(null)
  const [draft, setDraft] = useState(emptyProfile)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, bRes] = await Promise.all([
        fetch('/api/admin/finances/pricing-profiles'),
        fetch('/api/admin/finances/payout-batches'),
      ])
      const pJson = await pRes.json()
      const bJson = await bRes.json()
      if (pJson.success) {
        setProfiles(pJson.data || [])
        setSimProfileId((prev) => prev || pJson.data?.[0]?.id || '')
      }
      if (bJson.success) setBatches(bJson.data || [])
    } catch (e) {
      toast({ title: 'Ошибка загрузки', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const simProfile = profiles.find((p) => p.id === simProfileId) || profiles[0]

  const runSimulate = async () => {
    if (!simProfile) return
    const res = await fetch('/api/admin/finances/pricing-profiles/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtotal_thb: Number(simSubtotal), profile: simProfile }),
    })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Симуляция', description: json.error, variant: 'destructive' })
      return
    }
    setSimResult(json.data)
  }

  const createPool = async (force = false) => {
    const res = await fetch('/api/admin/finances/payout-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rail: 'TBANK_RU', force }),
    })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Пул', description: json.message || json.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Пул создан', description: `batch ${json.batchId}, ${json.itemCount} поз.` })
    load()
  }

  const lockBatch = async (id) => {
    await fetch(`/api/admin/finances/payout-batches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock' }),
    })
    load()
  }

  const exportBatch = (id, format) => {
    window.open(`/api/admin/finances/payout-batches/${id}/export?format=${format}`, '_blank')
  }

  const loadCompliance = async () => {
    if (!complianceId.trim()) return
    const res = await fetch(`/api/admin/finances/compliance/${complianceId.trim()}`)
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Compliance', description: json.error, variant: 'destructive' })
      return
    }
    setCompliance(json.data)
  }

  const downloadComplianceCsv = () => {
    if (!complianceId.trim()) return
    window.open(
      `/api/admin/finances/compliance/${encodeURIComponent(complianceId.trim())}?format=csv`,
      '_blank',
    )
  }

  const retryFiscal = async () => {
    if (!complianceId.trim()) return
    const res = await fetch(`/api/admin/finances/fiscal-retry/${complianceId.trim()}`, {
      method: 'POST',
    })
    const json = await res.json()
    toast({
      title: json.success ? 'Fiscal retry' : 'Ошибка',
      description: json.receiptId || json.error || json.status,
      variant: json.success ? 'default' : 'destructive',
    })
    loadCompliance()
  }

  const saveProfile = async () => {
    const res = await fetch('/api/admin/finances/pricing-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Профиль', description: json.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Профиль сохранён' })
    setDraft(emptyProfile)
    load()
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/admin/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Настройки
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">FinTech (Stage 98)</h1>
          <p className="text-sm text-muted-foreground">
            Pricing, treasury, compliance — см. docs/PRE_LAUNCH_CHECKLIST.md
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="profiles">
        <TabsList>
          <TabsTrigger value="profiles">Pricing profiles</TabsTrigger>
          <TabsTrigger value="batches">Payout batches</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Симулятор</CardTitle>
              <CardDescription>RU/KG/FX/rounding — не для гостей и партнёров</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label>Субтотал THB</Label>
                  <Input value={simSubtotal} onChange={(e) => setSimSubtotal(e.target.value)} />
                </div>
                <div>
                  <Label>Профиль</Label>
                  <select
                    className="border rounded h-10 px-2 min-w-[200px]"
                    value={simProfileId}
                    onChange={(e) => setSimProfileId(e.target.value)}
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={runSimulate}>
                  <Play className="h-4 w-4 mr-1" />
                  Считать
                </Button>
              </div>
              {simResult && (
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-80">
                  {JSON.stringify(simResult, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Новый pricing profile</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                'id',
                'name',
                'guest_fee_pct',
                'ru_agent_share_pct',
                'kr_service_share_pct',
                'fx_markup_pct',
                'host_fee_pct',
              ].map((key) => (
                <div key={key}>
                  <Label>{key}</Label>
                  <Input
                    value={draft[key] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </div>
              ))}
              <Button className="col-span-full md:col-span-1" onClick={saveProfile}>
                Создать
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Профили в БД</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {profiles.map((p) => (
                  <li key={p.id} className="border rounded p-2">
                    <strong>{p.name}</strong> ({p.id}) — guest {p.guest_fee_pct}% = RU{' '}
                    {p.ru_agent_share_pct}% + KG {p.kr_service_share_pct}%
                    {!p.is_active && <Badge className="ml-2">off</Badge>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batches" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Пулы ПН / ЧТ</CardTitle>
              <CardDescription>DRAFT → LOCKED → EXPORTED → SETTLED</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => createPool(false)}>Сформировать пул на сегодня</Button>
              <Button variant="outline" onClick={() => createPool(true)}>
                Force (не ПН/ЧТ)
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <ul className="space-y-2 text-sm">
                {batches.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-2 border rounded p-2">
                    <span>
                      {b.id} — <Badge>{b.status}</Badge> — {b.item_count} шт., ฿{b.totals_thb}
                    </span>
                    {b.status === 'DRAFT' && (
                      <Button size="sm" variant="secondary" onClick={() => lockBatch(b.id)}>
                        <Lock className="h-3 w-3 mr-1" />
                        Lock
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => exportBatch(b.id, 'csv')}>
                      <Download className="h-3 w-3 mr-1" />
                      CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportBatch(b.id, 'json')}>
                      JSON
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="text-base">Fiscal production</CardTitle>
              <CardDescription>
                Перед live: FISCAL_SANDBOX=false, FISCAL_PROVIDER_URL → prod OFD. Supplier: KG name + RU INN
                (agent_sign=5).
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Compliance export</CardTitle>
              <CardDescription>final_breakdown, ledger legs, fiscal — для бухгалтерии</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="booking UUID"
                  value={complianceId}
                  onChange={(e) => setComplianceId(e.target.value)}
                  className="max-w-md"
                />
                <Button onClick={loadCompliance}>Загрузить</Button>
                <Button variant="outline" onClick={downloadComplianceCsv} disabled={!complianceId.trim()}>
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button variant="secondary" onClick={retryFiscal}>
                  Retry fiscal
                </Button>
              </div>
              {compliance && (
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
                  {JSON.stringify(compliance, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}