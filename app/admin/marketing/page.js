'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp, Plus, Trash2, Percent, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MarketingPage() {
  const { toast } = useToast();
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPromo, setNewPromo] = useState({
    code: '',
    type: 'PERCENT',
    value: '',
    expiryDate: '',
    usageLimit: '',
  });

  useEffect(() => {
    loadPromoCodes();
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

  const handleCreate = async () => {
    if (!newPromo.code || !newPromo.value || !newPromo.expiryDate || !newPromo.usageLimit) {
      toast({
        title: 'Ошибка',
        description: 'Заполните все поля',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPromo),
      });

      if (res.ok) {
        toast({
          title: '✅ Промокод создан',
          description: `${newPromo.code} готов к использованию`,
        });
        setShowCreateModal(false);
        setNewPromo({ code: '', type: 'PERCENT', value: '', expiryDate: '', usageLimit: '' });
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
    if (!p.expiryDate) return true;
    return new Date(p.expiryDate) > new Date();
  });
  const totalUsage = promoCodes.reduce((sum, p) => sum + p.usedCount, 0);
  const criticalPlatformPromos = promoCodes.filter(isPlatformPromoCritical);

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
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-xs sm:text-sm text-gray-600">Исп-ний</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0"><div className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600">{totalUsage}</div></CardContent>
        </Card>
      </div>

      {/* Table - Mobile Responsive */}
      <Card className="shadow-xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />Промокоды</CardTitle>
          <CardDescription className="text-sm">Коды для скидок и акций</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-3 sm:space-y-4">
            {promoCodes.map((promo) => {
              const isExpired = Boolean(promo.expiryDate) && new Date(promo.expiryDate) < new Date();
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
                              ? `${promo.usedCount}/∞`
                              : `${promo.usedCount}/${promo.usageLimit}`}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Истекает:</p>
                        <p className="font-semibold text-sm sm:text-base">
                          {promo.expiryDate ? new Date(promo.expiryDate).toLocaleDateString('ru-RU') : '—'}
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
            <div><Label>Дата истечения *</Label><Input type="date" value={newPromo.expiryDate} onChange={(e) => setNewPromo({ ...newPromo, expiryDate: e.target.value })} className="mt-2" /></div>
            <div><Label>Лимит использований *</Label><Input type="number" placeholder="100" value={newPromo.usageLimit} onChange={(e) => setNewPromo({ ...newPromo, usageLimit: e.target.value })} className="mt-2" /></div>
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
