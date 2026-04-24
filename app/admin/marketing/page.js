'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TrendingUp, Plus, Trash2, Percent, DollarSign, Calendar, AlertTriangle, Users, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function promoExpiryEndMs(promo) {
  if (promo?.validUntilIso) return new Date(promo.validUntilIso).getTime();
  if (promo?.expiryDate) return new Date(`${promo.expiryDate}T23:59:59.999Z`).getTime();
  return NaN;
}

function isPlatformPromoCritical(promo) {
  if (String(promo.createdByType || '').toUpperCase() !== 'PLATFORM') return false;
  const limit = promo.usageLimit;
  if (limit == null || limit <= 0) return false;
  if (!promo.isActive) return false;
  const end = promoExpiryEndMs(promo);
  if (Number.isFinite(end) && end < Date.now()) return false;
  const used = Number(promo.usedCount) || 0;
  return used / limit >= 0.9;
}

export default function MarketingPage() {
  const { toast } = useToast();
  const [promoCodes, setPromoCodes] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [promoListFilter, setPromoListFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [extendingId, setExtendingId] = useState(null);
  const [topPartners, setTopPartners] = useState([]);
  const [allowedListingIdsRaw, setAllowedListingIdsRaw] = useState('');
  const [campaignForm, setCampaignForm] = useState({
    title: '',
    subtitle: '',
    startsAtIso: '',
    endsAtIso: '',
    promoCodeIds: [],
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPromo, setNewPromo] = useState({
    code: '',
    type: 'PERCENT',
    value: '',
    expiryDate: '',
    usageLimit: '',
    isFlashSale: false,
    flashEndsInHours: '24',
  });

  useEffect(() => {
    loadPromoCodes();
    loadCampaigns();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTop() {
      try {
        const res = await fetch('/api/admin/promo-codes/analytics/top-partners');
        const j = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(j.data)) setTopPartners(j.data);
      } catch {
        /* ignore */
      }
    }
    void loadTop();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPromoCodes = async () => {
    try {
      const res = await fetch('/api/admin/promo-codes');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPromoCodes(Array.isArray(data.data) ? data.data : []);
      } else {
        toast({
          title: 'Не удалось загрузить промокоды',
          description: data.error || res.statusText,
          variant: 'destructive',
        });
        setPromoCodes([]);
      }
    } catch (error) {
      console.error('Failed to load promo codes:', error);
      toast({ title: 'Ошибка сети', description: 'Повторите позже', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    setCampaignLoading(true);
    try {
      const res = await fetch('/api/admin/marketing/campaigns');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCampaigns(Array.isArray(data.data) ? data.data : []);
      } else {
        toast({
          title: 'Не удалось загрузить кампании',
          description: data.error || res.statusText,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Ошибка сети при загрузке кампаний', variant: 'destructive' });
    } finally {
      setCampaignLoading(false);
    }
  };

  const toggleCampaignPromo = (promoId) => {
    setCampaignForm((prev) => {
      const has = prev.promoCodeIds.includes(promoId);
      return {
        ...prev,
        promoCodeIds: has
          ? prev.promoCodeIds.filter((id) => id !== promoId)
          : [...prev.promoCodeIds, promoId],
      };
    });
  };

  const handleCreateCampaign = async () => {
    if (!campaignForm.title.trim()) {
      toast({ title: 'Введите заголовок кампании', variant: 'destructive' });
      return;
    }
    if (campaignForm.promoCodeIds.length < 1) {
      toast({ title: 'Выберите минимум 1 PLATFORM-код', variant: 'destructive' });
      return;
    }
    try {
      const payload = {
        title: campaignForm.title.trim(),
        subtitle: campaignForm.subtitle.trim(),
        promoCodeIds: campaignForm.promoCodeIds,
        startsAtIso: campaignForm.startsAtIso
          ? new Date(campaignForm.startsAtIso).toISOString()
          : null,
        endsAtIso: campaignForm.endsAtIso ? new Date(campaignForm.endsAtIso).toISOString() : null,
      };
      const res = await fetch('/api/admin/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Не удалось создать кампанию',
          description: data.error || res.statusText,
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Global Campaign создана' });
      setCampaignForm({
        title: '',
        subtitle: '',
        startsAtIso: '',
        endsAtIso: '',
        promoCodeIds: [],
      });
      await loadCampaigns();
    } catch {
      toast({ title: 'Ошибка сети', variant: 'destructive' });
    }
  };

  const handleCreate = async () => {
    if (!newPromo.code || !newPromo.value || !newPromo.usageLimit) {
      toast({
        title: 'Ошибка',
        description: 'Заполните все поля',
        variant: 'destructive',
      });
      return;
    }
    if (!newPromo.isFlashSale && !newPromo.expiryDate) {
      toast({
        title: 'Ошибка',
        description: 'Укажите дату завершения акции',
        variant: 'destructive',
      });
      return;
    }
    if (newPromo.isFlashSale && !['3', '6', '12', '24'].includes(String(newPromo.flashEndsInHours))) {
      toast({
        title: 'Ошибка',
        description: 'Для Flash Sale выберите пресет времени: 3/6/12/24 часа',
        variant: 'destructive',
      });
      return;
    }

    try {
      const allowedListingIds = allowedListingIdsRaw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        ...newPromo,
        ...(newPromo.isFlashSale
          ? {
              validUntilIso: new Date(
                Date.now() + Number(newPromo.flashEndsInHours || 24) * 3600 * 1000,
              ).toISOString(),
            }
          : {}),
        ...(allowedListingIds.length ? { allowedListingIds } : {}),
      };
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: '✅ Промокод создан',
          description: `${newPromo.code} готов к использованию`,
        });
        setShowCreateModal(false);
        setAllowedListingIdsRaw('');
        setNewPromo({
          code: '',
          type: 'PERCENT',
          value: '',
          expiryDate: '',
          usageLimit: '',
          isFlashSale: false,
          flashEndsInHours: '24',
        });
        loadPromoCodes();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'Не удалось создать',
          description: err.error || res.statusText,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать промокод',
        variant: 'destructive',
      });
    }
  };

  const handleExtendUses = async (id, code) => {
    setExtendingId(id);
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend_uses', add: 100 }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: 'Лимит расширен',
          description: `${code}: +100 использований`,
        });
        loadPromoCodes();
      } else {
        toast({
          title: 'Не удалось расширить',
          description: json.error || res.statusText,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Ошибка сети', variant: 'destructive' });
    } finally {
      setExtendingId(null);
    }
  };

  const handleDelete = async (id, code) => {
    if (!confirm(`Удалить промокод ${code}?`)) return;

    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Промокод удалён' });
        loadPromoCodes();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'Ошибка удаления',
          description: err.error || res.statusText,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  const activePromos = promoCodes.filter((p) => {
    if (!p.isActive) return false;
    const end = promoExpiryEndMs(p);
    if (!Number.isFinite(end)) return true;
    return end > Date.now();
  });
  const totalUsage = promoCodes.reduce((sum, p) => sum + p.usedCount, 0);
  const criticalPlatformPromos = promoCodes.filter(isPlatformPromoCritical);

  const displayedPromos = useMemo(() => {
    if (promoListFilter !== 'flash') return promoCodes;
    return promoCodes.filter((p) => {
      if (!p.isFlashSale) return false;
      if (!p.isActive) return false;
      const lim = p.usageLimit != null && p.usedCount >= p.usageLimit;
      if (lim) return false;
      const end = promoExpiryEndMs(p);
      return Number.isFinite(end) && end > Date.now();
    });
  }, [promoCodes, promoListFilter]);

  const platformPromos = useMemo(
    () =>
      promoCodes.filter((p) => String(p.createdByType || '').toUpperCase() === 'PLATFORM' && p.isActive),
    [promoCodes],
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Маркетинг</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Управление промокодами и акциями</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 w-full sm:w-auto">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />Создать промокод
        </Button>
      </div>

      {criticalPlatformPromos.length > 0 ? (
        <Card className="border-2 border-red-300 bg-gradient-to-r from-red-50 to-orange-50 shadow-md">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-red-900">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-red-600" />
              Critical Promo Alerts
            </CardTitle>
            <CardDescription className="text-red-900/80 text-sm">
              PLATFORM-коды с остатком лимита меньше 10% — расширьте лимит, чтобы не потерять трафик на чекауте.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
            {criticalPlatformPromos.map((p) => (
              <div
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-red-200 bg-white/90 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono font-bold text-red-950 truncate">{p.code}</p>
                  <p className="text-xs text-red-800/90 tabular-nums mt-1">
                    Использовано {p.usedCount} из {p.usageLimit} ({Math.round((p.usedCount / p.usageLimit) * 100)}%)
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 shrink-0"
                  disabled={extendingId === p.id}
                  onClick={() => void handleExtendUses(p.id, p.code)}
                >
                  {extendingId === p.id ? '…' : 'Extend +100'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Stats - Mobile Responsive */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
        <Card className="border-2 border-green-100">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-xs sm:text-sm text-gray-600">Активные</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0"><div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{activePromos.length}</div></CardContent>
        </Card>
        <Card className="border-2 border-blue-100">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-xs sm:text-sm text-gray-600">Всего</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0"><div className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600">{promoCodes.length}</div></CardContent>
        </Card>
        <Card className="border-2 border-purple-100">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-xs sm:text-sm text-gray-600">Оплач./Заверш.</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0"><div className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600">{totalUsage}</div></CardContent>
        </Card>
      </div>

      {topPartners.length > 0 ? (
        <Card className="border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white shadow-sm">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-indigo-950">
              <Users className="h-5 w-5 text-indigo-600 shrink-0" />
              Топ партнёров по промокодам
            </CardTitle>
            <CardDescription className="text-sm text-indigo-900/80">
              Кто создаёт больше всего PARTNER-кодов (вовлечённость в продвижение).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Партнёр</th>
                    <th className="py-2 pr-2">Кодов</th>
                    <th className="py-2">Использований</th>
                  </tr>
                </thead>
                <tbody>
                  {topPartners.map((row, i) => (
                    <tr key={row.partnerId} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                      <td className="py-2 pr-2 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {row.partnerName || row.partnerId}
                        </div>
                        {row.partnerEmail ? (
                          <div className="text-xs text-gray-500 truncate">{row.partnerEmail}</div>
                        ) : null}
                        <div className="text-[11px] text-gray-400 font-mono truncate mt-0.5">
                          {(row.codes || []).join(', ')}
                        </div>
                      </td>
                      <td className="py-2 pr-2 tabular-nums font-semibold text-indigo-700">{row.promoCount}</td>
                      <td className="py-2 tabular-nums text-gray-700">{row.totalUses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border border-rose-100 bg-gradient-to-br from-rose-50/70 to-white shadow-sm">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-rose-950">
            <Calendar className="h-5 w-5 text-rose-600 shrink-0" />
            Global Campaign Landing
          </CardTitle>
          <CardDescription className="text-sm text-rose-900/80">
            Объединяйте несколько PLATFORM-промокодов под единой распродажей и заголовком.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Заголовок Campaign *</Label>
              <Input
                value={campaignForm.title}
                onChange={(e) => setCampaignForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Summer Super Sale"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Подзаголовок</Label>
              <Input
                value={campaignForm.subtitle}
                onChange={(e) => setCampaignForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                placeholder="До -30% на selected listings"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Старт (опционально)</Label>
              <Input
                type="datetime-local"
                value={campaignForm.startsAtIso}
                onChange={(e) => setCampaignForm((prev) => ({ ...prev, startsAtIso: e.target.value }))}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Финиш (опционально)</Label>
              <Input
                type="datetime-local"
                value={campaignForm.endsAtIso}
                onChange={(e) => setCampaignForm((prev) => ({ ...prev, endsAtIso: e.target.value }))}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label>PLATFORM-коды для объединения *</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {platformPromos.slice(0, 24).map((promo) => (
                <label
                  key={promo.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
                >
                  <Checkbox
                    checked={campaignForm.promoCodeIds.includes(promo.id)}
                    onCheckedChange={() => toggleCampaignPromo(promo.id)}
                  />
                  <span className="font-mono">{promo.code}</span>
                </label>
              ))}
            </div>
            {platformPromos.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Нет активных PLATFORM-кодов для объединения.</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              Выбрано кодов: <span className="font-semibold">{campaignForm.promoCodeIds.length}</span>
            </p>
            <Button onClick={handleCreateCampaign} className="bg-rose-600 hover:bg-rose-700">
              Создать Campaign
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Активные кампании</p>
            {campaignLoading ? (
              <p className="text-sm text-slate-500">Загрузка…</p>
            ) : campaigns.length === 0 ? (
              <p className="text-sm text-slate-500">Пока нет кампаний.</p>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="font-semibold text-slate-900">{campaign.title}</p>
                  {campaign.subtitle ? (
                    <p className="text-xs text-slate-600 mt-0.5">{campaign.subtitle}</p>
                  ) : null}
                  <p className="text-xs text-slate-500 mt-1">
                    Codes: {(campaign.promoCodeIds || []).length} |{' '}
                    {(campaign.promoCodeIds || []).join(', ')}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table - Mobile Responsive */}
      <Card className="shadow-xl">
        <CardHeader className="p-4 sm:p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
              Промокоды
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={promoListFilter === 'all' ? 'default' : 'outline'}
                className={promoListFilter === 'all' ? 'bg-indigo-600' : ''}
                onClick={() => setPromoListFilter('all')}
              >
                Все
              </Button>
              <Button
                type="button"
                size="sm"
                variant={promoListFilter === 'flash' ? 'default' : 'outline'}
                className={promoListFilter === 'flash' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                onClick={() => setPromoListFilter('flash')}
              >
                <Zap className="w-4 h-4 mr-1 inline" />
                Flash Sales
              </Button>
            </div>
          </div>
          <CardDescription className="text-sm">
            Коды для скидок и акций
            {promoListFilter === 'flash'
              ? ' — активные срочные акции (is_flash_sale + valid_until в будущем).'
              : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-3 sm:space-y-4">
            {displayedPromos.map((promo) => {
              const endMs = promoExpiryEndMs(promo);
              const isExpired = Number.isFinite(endMs) && endMs < Date.now();
              const isLimitReached =
                promo.usageLimit != null && promo.usedCount >= promo.usageLimit;
              const isActive = promo.isActive && !isExpired && !isLimitReached;
              const isCritical = isPlatformPromoCritical(promo);

              return (
                <div key={promo.id} className={`p-3 sm:p-4 lg:p-6 rounded-xl border-2 transition-all ${
                  isCritical
                    ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-400 ring-2 ring-red-100'
                    : isActive ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' : 'bg-gray-50 border-gray-300 opacity-60'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-xl lg:text-2xl flex-shrink-0 ${
                        isActive ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-400'
                      }`}>{promo.type === 'PERCENT' ? '📊' : '💰'}</div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 font-mono truncate">{promo.code}</h3>
                        <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 sm:mt-2">
                          <Badge className={`text-xs ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {isActive ? 'Активен' : isExpired ? 'Истёк' : isLimitReached ? 'Лимит' : 'Неактивен'}
                          </Badge>
                          {String(promo.createdByType || '').toUpperCase() === 'PLATFORM' ? (
                            <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-800">PLATFORM</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-amber-200 text-amber-900">PARTNER</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{promo.type === 'PERCENT' ? `${promo.value}%` : `${promo.value} ₿`}</Badge>
                          <Badge variant="outline" className="text-xs">
                            {promo.usageLimit == null
                              ? `Оплачено/завершено: ${promo.usedCount}/∞`
                              : `Оплачено/завершено: ${promo.usedCount}/${promo.usageLimit}`}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Создано броней: {promo.bookingsCreatedCount || 0}
                          </Badge>
                          {Array.isArray(promo.allowedListingIds) && promo.allowedListingIds.length > 0 ? (
                            <Badge variant="outline" className="text-xs border-violet-200 text-violet-900">
                              scope: {promo.allowedListingIds.length}
                            </Badge>
                          ) : null}
                          {promo.isFlashSale ? (
                            <Badge className="text-xs border-0 bg-gradient-to-r from-orange-500 to-rose-500 text-white">
                              FLASH
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Истекает:</p>
                        <p className="font-semibold text-sm sm:text-base">
                          {promo.validUntilIso
                            ? new Date(promo.validUntilIso).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : promo.expiryDate
                              ? new Date(promo.expiryDate).toLocaleDateString('ru-RU')
                              : '—'}
                        </p>
                      </div>
                      <div className="flex gap-2 sm:mt-2">
                        {isCritical ? (
                          <Button
                            size="sm"
                            className="h-8 bg-red-600 hover:bg-red-700"
                            disabled={extendingId === promo.id}
                            onClick={() => void handleExtendUses(promo.id, promo.code)}
                          >
                            {extendingId === promo.id ? '…' : 'Extend +100'}
                          </Button>
                        ) : null}
                        <Button size="sm" variant="destructive" className="h-8" onClick={() => handleDelete(promo.id, promo.code)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">Создать промокод</DialogTitle>
            <DialogDescription>Новая маркетинговая акция</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Код *</Label><Input placeholder="PHUKET2025" value={newPromo.code} onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} className="mt-2 font-mono text-lg" /></div>
            <div><Label>Тип скидки *</Label><Select value={newPromo.type} onValueChange={(value) => setNewPromo({ ...newPromo, type: value })}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PERCENT">Процент (%)</SelectItem><SelectItem value="FIXED">Фиксированная (THB)</SelectItem></SelectContent></Select></div>
            <div><Label>Значение *</Label><Input type="number" placeholder={newPromo.type === 'PERCENT' ? '10' : '5000'} value={newPromo.value} onChange={(e) => setNewPromo({ ...newPromo, value: e.target.value })} className="mt-2" /></div>
            <div className="flex items-start gap-3 rounded-lg border border-orange-100 bg-orange-50/60 p-3">
              <Checkbox
                id="admin-flash-sale"
                checked={newPromo.isFlashSale}
                onCheckedChange={(v) => setNewPromo({ ...newPromo, isFlashSale: Boolean(v) })}
              />
              <div className="space-y-1">
                <Label htmlFor="admin-flash-sale" className="cursor-pointer font-medium text-orange-950">
                  Flash Sale
                </Label>
                <p className="text-xs text-orange-900/85 leading-relaxed">
                  Срочная акция с коротким дедлайном. Время окончания уйдёт в valid_until.
                </p>
              </div>
            </div>
            {newPromo.isFlashSale ? (
              <div>
                <Label>Flash-пресет времени *</Label>
                <Select
                  value={String(newPromo.flashEndsInHours)}
                  onValueChange={(value) => setNewPromo({ ...newPromo, flashEndsInHours: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 часа</SelectItem>
                    <SelectItem value="6">6 часов</SelectItem>
                    <SelectItem value="12">12 часов</SelectItem>
                    <SelectItem value="24">24 часа</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div><Label>Дата истечения *</Label><Input type="date" value={newPromo.expiryDate} onChange={(e) => setNewPromo({ ...newPromo, expiryDate: e.target.value })} className="mt-2" /></div>
            )}
            <div><Label>Лимит использований *</Label><Input type="number" placeholder="100" value={newPromo.usageLimit} onChange={(e) => setNewPromo({ ...newPromo, usageLimit: e.target.value })} className="mt-2" /></div>
            <div>
              <Label>Лимит по листингам (опционально)</Label>
              <Textarea
                placeholder="UUID листингов через запятую — код сработает только на них"
                value={allowedListingIdsRaw}
                onChange={(e) => setAllowedListingIdsRaw(e.target.value)}
                className="mt-2 min-h-[72px] text-sm font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Отмена</Button>
            <Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700">✅ Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
