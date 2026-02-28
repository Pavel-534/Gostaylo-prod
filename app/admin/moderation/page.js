'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Eye, Mail, FileText, Image as ImageIcon, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ModerationPage() {
  const { toast } = useToast();
  const [partners, setPartners] = useState([]);
  const [listings, setListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';

  const loadData = async () => {
    try {
      // Load PENDING listings directly from Supabase
      const listingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?status=eq.PENDING&order=created_at.desc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const listingsData = await listingsRes.json();
      setListings(Array.isArray(listingsData) ? listingsData : []);
      
      // Load partners pending verification
      const partnersRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?role=eq.PARTNER&verified=eq.false&select=*`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const partnersData = await partnersRes.json();
      setPartners(Array.isArray(partnersData) ? partnersData : []);
      
    } catch (error) {
      console.error('Failed to load moderation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePartner = async (partnerId) => {
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/verify`, {
        method: 'POST',
      });

      if (res.ok) {
        toast({
          title: '✅ Партнер верифицирован',
          description: 'Уведомление отправлено на email и Telegram',
        });
        loadData();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось верифицировать партнера',
        variant: 'destructive',
      });
    }
  };

  const handleRejectPartner = async (partnerId) => {
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Does not meet platform requirements' }),
      });

      if (res.ok) {
        toast({
          title: 'Партнер отклонен',
          description: 'Статус обновлен',
        });
        loadData();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отклонить партнера',
        variant: 'destructive',
      });
    }
  };

  const handleApproveListing = async (listingId) => {
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';
    
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
        method: 'PATCH',
        headers: { 
          'apikey': SUPABASE_SERVICE_KEY, 
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status: 'ACTIVE',
          available: true,
          moderated_at: new Date().toISOString()
        }),
      });

      if (res.ok) {
        toast({
          title: '✅ Объявление одобрено',
          description: 'Листинг теперь виден на платформе',
        });
        setSelectedListing(null);
        loadData();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось одобрить объявление',
        variant: 'destructive',
      });
    }
  };

  const handleRejectListing = async (listingId) => {
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';
    
    try {
      // Get current metadata first
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=metadata`, {
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const getData = await getRes.json();
      const currentMetadata = getData?.[0]?.metadata || {};
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
        method: 'PATCH',
        headers: { 
          'apikey': SUPABASE_SERVICE_KEY, 
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status: 'PENDING',  // Keep as PENDING but mark as rejected in metadata
          available: false,
          metadata: { ...currentMetadata, is_rejected: true, rejected_at: new Date().toISOString() }
        }),
      });

      if (res.ok) {
        toast({
          title: 'Объявление отклонено',
          description: 'Требуются доработки',
        });
        setSelectedListing(null);
        loadData();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отклонить объявление',
        variant: 'destructive',
      });
    }
  };

  const handleToggleFeatured = async (listingId, currentStatus) => {
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';
    
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
        method: 'PATCH',
        headers: { 
          'apikey': SUPABASE_SERVICE_KEY, 
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_featured: !currentStatus }),
      });

      if (res.ok) {
        toast({
          title: !currentStatus ? '⭐ Добавлено в рекомендации' : 'Удалено из рекомендаций',
          description: !currentStatus ? 'Листинг будет показан первым' : 'Листинг в обычном порядке',
        });
        loadData();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить статус Featured',
        variant: 'destructive',
      });
    }
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
        <h1 className="text-3xl font-bold text-gray-900">Модерация</h1>
        <p className="text-gray-600 mt-1">Верификация партнеров и проверка объявлений</p>
      </div>

      {/* Partner Verification Queue */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Верификация партнеров
            <Badge variant="destructive">{partners.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Нет партнеров на верификации</p>
          ) : (
            <div className="space-y-4">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-gray-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-indigo-600">
                          {partner.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{partner.name}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {partner.email}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {partner.verificationDocs?.passport && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="w-3 h-3 mr-1" />
                          Паспорт
                        </Badge>
                      )}
                      {partner.verificationDocs?.bankAccount && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="w-3 h-3 mr-1" />
                          Банк
                        </Badge>
                      )}
                      {partner.verificationDocs?.businessLicense && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="w-3 h-3 mr-1" />
                          Лицензия
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprovePartner(partner.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleRejectPartner(partner.id)}
                      variant="destructive"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Listing Moderation */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Модерация объявлений
            <Badge variant="destructive">{listings.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listings.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Нет объявлений на проверке</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-indigo-400 transition-all"
                >
                  <div className="relative h-48 bg-gray-200">
                    <img
                      src={listing.images?.[0] || listing.cover_image || '/placeholder.jpg'}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                    <Badge className="absolute top-2 right-2 bg-yellow-500">
                      PENDING
                    </Badge>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">{listing.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{listing.owner_id}</p>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-indigo-600">
                        {(listing.base_price_thb || 0).toLocaleString()} ₿/день
                      </span>
                      <Badge variant="outline">Комиссия: {listing.commission_rate || 15}%</Badge>
                    </div>
                    {/* Featured Toggle */}
                    <div className="flex items-center justify-between mb-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2">
                        <Star className={`w-4 h-4 ${listing.is_featured ? 'text-purple-600 fill-purple-600' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium text-gray-700">Рекомендуем</span>
                      </div>
                      <Switch
                        checked={listing.is_featured || false}
                        onCheckedChange={() => handleToggleFeatured(listing.id, listing.is_featured)}
                      />
                    </div>
                    <Button
                      onClick={() => setSelectedListing(listing)}
                      variant="outline"
                      className="w-full"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Quick View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick View Modal */}
      <Dialog open={!!selectedListing} onOpenChange={() => setSelectedListing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Детальный просмотр</DialogTitle>
            <DialogDescription>Проверьте все данные перед одобрением</DialogDescription>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              {/* Images */}
              <div className="grid grid-cols-2 gap-2">
                {selectedListing.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ))}
              </div>

              {/* Info */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Название</p>
                  <p className="font-semibold text-lg">{selectedListing.title}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Описание</p>
                  <p className="text-gray-900">{selectedListing.description}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Цена</p>
                    <p className="font-bold text-indigo-600">
                      {selectedListing.basePriceThb.toLocaleString()} ₿
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Комиссия</p>
                    <p className="font-bold text-purple-600">{selectedListing.commissionRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Район</p>
                    <p className="font-semibold">{selectedListing.district}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Владелец</p>
                  <p className="font-semibold">{selectedListing.ownerName}</p>
                  <p className="text-sm text-gray-500">{selectedListing.ownerEmail}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => handleApproveListing(selectedListing.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700 py-6 text-lg"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Одобрить
                </Button>
                <Button
                  onClick={() => handleRejectListing(selectedListing.id)}
                  variant="destructive"
                  className="flex-1 py-6 text-lg"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Отклонить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
