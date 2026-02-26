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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Безопасность</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Управление чёрным списком</p>
      </div>

      {/* Stats - Mobile Responsive */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        <Card className="border-2 border-red-100 bg-red-50">
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-xs sm:text-sm text-gray-600">Кошельки</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0"><div className="text-2xl sm:text-3xl font-bold text-red-600">{blacklist.wallets.length}</div></CardContent>
        </Card>
        <Card className="border-2 border-orange-100 bg-orange-50">
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-xs sm:text-sm text-gray-600">Телефоны</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0"><div className="text-2xl sm:text-3xl font-bold text-orange-600">{blacklist.phones.length}</div></CardContent>
        </Card>
      </div>

      {/* Wallets - Mobile Responsive */}
      <Card className="shadow-xl border-2 border-red-200">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Shield className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />Кошельки (USDT)</CardTitle>
              <CardDescription className="text-sm">Заблокированные адреса</CardDescription>
            </div>
            <Button onClick={() => setShowWalletModal(true)} variant="destructive" size="sm" className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" />Добавить</Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {blacklist.wallets.length === 0 ? <p className="text-center text-gray-500 py-6 sm:py-8 text-sm">Нет заблокированных кошельков</p> : (
            <div className="space-y-2 sm:space-y-3">
              {blacklist.wallets.map((wallet, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 p-3 sm:p-4 bg-red-50 rounded-lg border-2 border-red-200">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs sm:text-sm font-bold text-gray-900 truncate">{wallet.address}</p>
                    <p className="text-xs sm:text-sm text-red-700 mt-1 truncate">⚠️ {wallet.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(wallet.addedAt).toLocaleDateString('ru-RU')}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="flex-shrink-0"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phones - Mobile Responsive */}
      <Card className="shadow-xl border-2 border-orange-200">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />Телефоны</CardTitle>
              <CardDescription className="text-sm">Заблокированные номера</CardDescription>
            </div>
            <Button onClick={() => setShowPhoneModal(true)} className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto" size="sm"><Plus className="w-4 h-4 mr-2" />Добавить</Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {blacklist.phones.length === 0 ? <p className="text-center text-gray-500 py-6 sm:py-8 text-sm">Нет заблокированных телефонов</p> : (
            <div className="space-y-2 sm:space-y-3">
              {blacklist.phones.map((phone, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 p-3 sm:p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-base sm:text-lg text-gray-900">{phone.number}</p>
                    <p className="text-xs sm:text-sm text-orange-700 mt-1 truncate">⚠️ {phone.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(phone.addedAt).toLocaleDateString('ru-RU')}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="flex-shrink-0"><Trash2 className="w-4 h-4 text-orange-600" /></Button>
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
