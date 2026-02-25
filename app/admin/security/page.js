'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, AlertTriangle, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SecurityPage() {
  const { toast } = useToast();
  const [blacklist, setBlacklist] = useState({ wallets: [], phones: [] });
  const [loading, setLoading] = useState(true);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [newWallet, setNewWallet] = useState({ address: '', reason: '' });
  const [newPhone, setNewPhone] = useState({ number: '', reason: '' });

  useEffect(() => {
    loadBlacklist();
  }, []);

  const loadBlacklist = async () => {
    try {
      const res = await fetch('/api/admin/blacklist');
      if (res.ok) {
        const data = await res.json();
        setBlacklist(data.data);
      }
    } catch (error) {
      console.error('Failed to load blacklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWallet = async () => {
    if (!newWallet.address) {
      toast({ title: 'Введите адрес кошелька', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/admin/blacklist/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWallet),
      });

      if (res.ok) {
        toast({ title: '🔒 Кошелёк заблокирован' });
        setShowWalletModal(false);
        setNewWallet({ address: '', reason: '' });
        loadBlacklist();
      }
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  const handleAddPhone = async () => {
    if (!newPhone.number) {
      toast({ title: 'Введите номер телефона', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/admin/blacklist/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPhone),
      });

      if (res.ok) {
        toast({ title: '🔒 Телефон заблокирован' });
        setShowPhoneModal(false);
        setNewPhone({ number: '', reason: '' });
        loadBlacklist();
      }
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Безопасность</h1>
        <p className="text-gray-600 mt-1">Управление чёрным списком</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-red-100 bg-red-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Заблокированные кошельки</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-600">{blacklist.wallets.length}</div></CardContent>
        </Card>
        <Card className="border-2 border-orange-100 bg-orange-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Заблокированные телефоны</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-orange-600">{blacklist.phones.length}</div></CardContent>
        </Card>
      </div>

      {/* Wallets */}
      <Card className="shadow-xl border-2 border-red-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Shield className="w-6 h-6 text-red-600" />Заблокированные кошельки (USDT)</CardTitle>
              <CardDescription>Эти адреса не могут получать выплаты</CardDescription>
            </div>
            <Button onClick={() => setShowWalletModal(true)} variant="destructive"><Plus className="w-4 h-4 mr-2" />Добавить</Button>
          </div>
        </CardHeader>
        <CardContent>
          {blacklist.wallets.length === 0 ? <p className="text-center text-gray-500 py-8">Нет заблокированных кошельков</p> : (
            <div className="space-y-3">
              {blacklist.wallets.map((wallet, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border-2 border-red-200">
                  <div>
                    <p className="font-mono text-sm font-bold text-gray-900">{wallet.address}</p>
                    <p className="text-sm text-red-700 mt-1">⚠️ {wallet.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(wallet.addedAt).toLocaleDateString('ru-RU')}</p>
                  </div>
                  <Button size="sm" variant="ghost"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phones */}
      <Card className="shadow-xl border-2 border-orange-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-orange-600" />Заблокированные телефоны</CardTitle>
              <CardDescription>Эти номера не могут регистрироваться</CardDescription>
            </div>
            <Button onClick={() => setShowPhoneModal(true)} className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-2" />Добавить</Button>
          </div>
        </CardHeader>
        <CardContent>
          {blacklist.phones.length === 0 ? <p className="text-center text-gray-500 py-8">Нет заблокированных телефонов</p> : (
            <div className="space-y-3">
              {blacklist.phones.map((phone, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                  <div>
                    <p className="font-semibold text-lg text-gray-900">{phone.number}</p>
                    <p className="text-sm text-orange-700 mt-1">⚠️ {phone.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(phone.addedAt).toLocaleDateString('ru-RU')}</p>
                  </div>
                  <Button size="sm" variant="ghost"><Trash2 className="w-4 h-4 text-orange-600" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet Modal */}
      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Заблокировать кошелёк</DialogTitle><DialogDescription>USDT адрес будет добавлен в чёрный список</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>USDT Адрес *</Label><Input placeholder="TXYZAbCdEf..." value={newWallet.address} onChange={(e) => setNewWallet({ ...newWallet, address: e.target.value })} className="mt-2 font-mono" /></div>
            <div><Label>Причина</Label><Textarea placeholder="Fraud, multiple chargebacks..." value={newWallet.reason} onChange={(e) => setNewWallet({ ...newWallet, reason: e.target.value })} className="mt-2" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowWalletModal(false)}>Отмена</Button><Button onClick={handleAddWallet} variant="destructive">🔒 Заблокировать</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Modal */}
      <Dialog open={showPhoneModal} onOpenChange={setShowPhoneModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Заблокировать телефон</DialogTitle><DialogDescription>Номер будет добавлен в чёрный список</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Номер телефона *</Label><Input placeholder="+66999888777" value={newPhone.number} onChange={(e) => setNewPhone({ ...newPhone, number: e.target.value })} className="mt-2" /></div>
            <div><Label>Причина</Label><Textarea placeholder="Spam, fake bookings..." value={newPhone.reason} onChange={(e) => setNewPhone({ ...newPhone, reason: e.target.value })} className="mt-2" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowPhoneModal(false)}>Отмена</Button><Button onClick={handleAddPhone} className="bg-orange-600 hover:bg-orange-700">🔒 Заблокировать</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
