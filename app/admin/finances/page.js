'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, DollarSign, TrendingUp, Wallet, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function FinancesPage() {
  const { toast } = useToast();
  const [payouts, setPayouts] = useState([]);
  const [settings, setSettings] = useState({ defaultCommissionRate: 15 });
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/payout-requests?status=PENDING');
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.data);
      }
    } catch (error) {
      console.error('Failed to load payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedPayout) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/payouts/${selectedPayout.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });

      if (res.ok) {
        toast({
          title: '✅ Выплата обработана',
          description: `Уведомление отправлено партнеру. TX: ${transactionId || 'auto'}`,
        });
        setSelectedPayout(null);
        setTransactionId('');
        loadData();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обработать выплату',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast({
          title: '✅ Настройки сохранены',
          description: 'Комиссия платформы обновлена',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить настройки',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getMethodIcon = (method) => {
    return method === 'bank' ? '🏦' : '💎';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Финансы</h1>
        <p className="text-gray-600 mt-1">Управление выплатами и комиссиями платформы</p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-green-100 bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Заработано комиссии</CardTitle>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">187,500 ₿</div>
            <p className="text-xs text-gray-600 mt-1">Всего за всё время</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">В эскроу</CardTitle>
            <Wallet className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">245,000 ₿</div>
            <p className="text-xs text-gray-600 mt-1">Ожидают check-in</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending выплаты</CardTitle>
            <CreditCard className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{payouts.length}</div>
            <p className="text-xs text-gray-600 mt-1">Требуют обработки</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Management */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Запросы на выплату
            <Badge variant="destructive">{payouts.length}</Badge>
          </CardTitle>
          <CardDescription>
            Проверьте детали перед обработкой. Будьте внимательны с двойными выплатами!
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-xl font-semibold text-gray-900">Все выплаты обработаны!</p>
              <p className="text-gray-600">Нет pending запросов</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-3xl">
                      {getMethodIcon(payout.method)}
                    </div>
                    <div>
                      <p className="font-bold text-xl text-gray-900">
                        {payout.metadata?.partnerName || 'Partner'}
                      </p>
                      <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                        <span className="font-mono bg-white px-2 py-1 rounded">
                          {payout.destination}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Requested: {new Date(payout.requestedAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-purple-900 mb-1">
                      {payout.amount.toLocaleString('ru-RU')} {payout.currency}
                    </div>
                    <Badge className="mb-3">
                      {payout.method === 'bank' ? 'Bank Transfer' : 'USDT Crypto'}
                    </Badge>
                    <br />
                    <Button
                      onClick={() => setSelectedPayout(payout)}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6"
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Mark as Paid
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Settings */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Настройки комиссии</CardTitle>
          <CardDescription>Глобальные параметры платформы</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="commission">Комиссия платформы по умолчанию (%)</Label>
              <div className="flex gap-3 mt-2">
                <Input
                  id="commission"
                  type="number"
                  value={settings.defaultCommissionRate}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultCommissionRate: parseFloat(e.target.value) })
                  }
                  className="max-w-xs"
                />
                <Button onClick={handleUpdateSettings} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Текущая: {settings.defaultCommissionRate}% от стоимости бронирования
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Dialog open={!!selectedPayout} onOpenChange={() => setSelectedPayout(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              Подтверждение выплаты
            </DialogTitle>
            <DialogDescription className="text-base">
              Это действие нельзя отменить. Убедитесь, что средства были отправлены.
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4 py-4">
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <p className="font-semibold text-lg text-gray-900 mb-2">
                  Вы уверены, что отправили:
                </p>
                <div className="space-y-1 text-gray-700">
                  <p>
                    <span className="font-bold text-2xl text-purple-600">
                      {selectedPayout.amount.toLocaleString('ru-RU')} {selectedPayout.currency}
                    </span>
                  </p>
                  <p className="text-sm">
                    <strong>Кому:</strong> {selectedPayout.metadata?.partnerName}
                  </p>
                  <p className="text-sm">
                    <strong>Куда:</strong> {selectedPayout.destination}
                  </p>
                  <p className="text-sm">
                    <strong>Метод:</strong> {selectedPayout.method === 'bank' ? '🏦 Bank Transfer' : '💎 USDT'}
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="txId">Transaction ID (опционально)</Label>
                <Input
                  id="txId"
                  placeholder="TX-123456789 или номер платежа"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-900">
                  <strong>📬 После подтверждения:</strong>
                  <br />
                  Партнер получит уведомление на Email и в Telegram о том, что выплата обработана.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedPayout(null)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? 'Обработка...' : '✅ Подтвердить выплату'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
