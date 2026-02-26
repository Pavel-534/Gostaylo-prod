'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp, Plus, Trash2, Percent, DollarSign, Calendar } from 'lucide-react';
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
      if (res.ok) {
        const data = await res.json();
        setPromoCodes(data.data);
      }
    } catch (error) {
      console.error('Failed to load promo codes:', error);
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
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать промокод',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id, code) => {
    if (!confirm(`Удалить промокод ${code}?`)) return;

    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Промокод удалён' });
        loadPromoCodes();
      }
    } catch (error) {
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  const activePromos = promoCodes.filter(p => p.isActive && new Date(p.expiryDate) > new Date());
  const totalUsage = promoCodes.reduce((sum, p) => sum + p.usedCount, 0);

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
              const isExpired = new Date(promo.expiryDate) < new Date();
              const isLimitReached = promo.usedCount >= promo.usageLimit;
              const isActive = promo.isActive && !isExpired && !isLimitReached;

              return (
                <div key={promo.id} className={`p-3 sm:p-4 lg:p-6 rounded-xl border-2 transition-all ${
                  isActive ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' : 'bg-gray-50 border-gray-300 opacity-60'
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
                          <Badge variant="outline" className="text-xs">{promo.type === 'PERCENT' ? `${promo.value}%` : `${promo.value} ₿`}</Badge>
                          <Badge variant="outline" className="text-xs">{promo.usedCount}/{promo.usageLimit}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Истекает:</p>
                        <p className="font-semibold text-sm sm:text-base">{new Date(promo.expiryDate).toLocaleDateString('ru-RU')}</p>
                      </div>
                      <Button size="sm" variant="destructive" className="h-8 sm:mt-2" onClick={() => handleDelete(promo.id, promo.code)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
