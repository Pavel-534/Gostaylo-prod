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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Маркетинг</h1>
          <p className="text-gray-600 mt-1">Управление промокодами и акциями</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
          <Plus className="w-5 h-5 mr-2" />Создать промокод
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-green-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Активные</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{activePromos.length}</div></CardContent>
        </Card>
        <Card className="border-2 border-blue-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Всего кодов</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-600">{promoCodes.length}</div></CardContent>
        </Card>
        <Card className="border-2 border-purple-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Использований</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-purple-600">{totalUsage}</div></CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="w-6 h-6 text-indigo-600" />Промокоды</CardTitle>
          <CardDescription>Коды для скидок и акций</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {promoCodes.map((promo) => {
              const isExpired = new Date(promo.expiryDate) < new Date();
              const isLimitReached = promo.usedCount >= promo.usageLimit;
              const isActive = promo.isActive && !isExpired && !isLimitReached;

              return (
                <div key={promo.id} className={`p-6 rounded-xl border-2 transition-all ${
                  isActive ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' : 'bg-gray-50 border-gray-300 opacity-60'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl ${
                        isActive ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-400'
                      }`}>{promo.type === 'PERCENT' ? '📊' : '💰'}</div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 font-mono">{promo.code}</h3>
                        <div className="flex gap-2 mt-2">
                          <Badge className={isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {isActive ? 'Активен' : isExpired ? 'Истёк' : isLimitReached ? 'Лимит исчерпан' : 'Неактивен'}
                          </Badge>
                          <Badge variant="outline">{promo.type === 'PERCENT' ? `${promo.value}%` : `${promo.value} ₿`}</Badge>
                          <Badge variant="outline">{promo.usedCount}/{promo.usageLimit}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Истекает:</p>
                      <p className="font-semibold">{new Date(promo.expiryDate).toLocaleDateString('ru-RU')}</p>
                      <Button size="sm" variant="destructive" className="mt-3" onClick={() => handleDelete(promo.id, promo.code)}>
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
