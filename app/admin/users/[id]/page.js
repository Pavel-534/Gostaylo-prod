'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, User, Mail, Phone, Shield, Calendar, Building2, 
  DollarSign, FileText, Image as ImageIcon, CheckCircle, XCircle, Clock,
  LogIn, ExternalLink, AlertTriangle, Percent, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { ProxiedImage } from '@/components/proxied-image';
import { toAdminVerificationDocProxyUrl } from '@/lib/verification-doc-admin-url';

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id;
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [kycDocs, setKycDocs] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [systemCommission, setSystemCommission] = useState(null);
  const [customCommission, setCustomCommission] = useState('');

  useEffect(() => {
    loadUserData();
    loadSystemSettings();
  }, [userId]);

  const loadSystemSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        const r = parseFloat(data.data?.defaultCommissionRate);
        if (Number.isFinite(r) && r >= 0) {
          setSystemCommission(r);
          return;
        }
      }
      const cr = await fetch('/api/v2/commission', { cache: 'no-store' }).then((x) => x.json());
      if (cr.success && cr.data?.systemRate != null) {
        setSystemCommission(Number(cr.data.systemRate));
      }
    } catch (error) {
      console.error('Failed to load system settings:', error);
    }
  };

  const loadUserData = async () => {
    try {
      // Use new admin API endpoint that bypasses RLS with SERVICE_ROLE_KEY
      const response = await fetch(`/api/admin/users/${userId}`, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load user data');
      }

      const { data } = await response.json();

      // Set user profile
      if (data.profile) {
        const profile = data.profile;
        setUser({
          id: profile.id,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
          role: profile.role,
          phone: profile.phone,
          isVerified: profile.is_verified,
          verificationStatus: profile.verification_status,
          customCommissionRate: profile.custom_commission_rate,
          availableBalance: profile.available_balance,
          telegramId: profile.telegram_id,
          telegramUsername: profile.telegram_username,
          createdAt: profile.created_at,
          verificationDocUrl: profile.verification_doc_url,
          verificationDocType: profile.verification_doc_type,
          verificationSubmittedAt: profile.verification_submitted_at,
        });
        setCustomCommission(profile.custom_commission_rate?.toString() || '');
      }

      // Set KYC documents
      if (data.applications) {
        setKycDocs(data.applications);
      }

      // Set listings
      if (data.listings) {
        setListings(data.listings);
      }

    } catch (error) {
      console.error('Failed to load user data:', error);
      toast.error('Ошибка загрузки данных пользователя');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCommission = async () => {
    setSaving(true);
    try {
      const newRate = customCommission === '' ? null : parseFloat(customCommission);

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId,
          updates: { custom_commission_rate: newRate }
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success(customCommission 
          ? `Персональная комиссия установлена: ${customCommission}%`
          : 'Используется системная комиссия'
        );
        setUser(prev => ({ ...prev, customCommissionRate: newRate }));
      } else {
        throw new Error(data.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Save commission error:', error);
      toast.error('Не удалось сохранить комиссию');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (newRole) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId,
          updates: { role: newRole }
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Роль изменена на ${newRole}`);
        setUser(prev => ({ ...prev, role: newRole }));
        try {
          const raw = localStorage.getItem('gostaylo_user');
          if (raw) {
            const self = JSON.parse(raw);
            if (String(self?.id) === String(userId)) {
              window.dispatchEvent(new Event('gostaylo-switch-role'));
            }
          }
        } catch {
          /* ignore */
        }
      } else {
        throw new Error(data.error || 'Failed to update');
      }
    } catch (error) {
      toast.error('Не удалось изменить роль');
    }
  };

  const handleLoginAs = async () => {
    try {
      await fetch('/api/v2/admin/audit/impersonation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: user.id,
          targetRole: user.role,
        }),
      });
    } catch (e) {
      console.warn('[impersonation audit]', e);
    }

    const currentUser = localStorage.getItem('gostaylo_user');
    if (currentUser) {
      const parsed = JSON.parse(currentUser);
      if (!parsed.isImpersonated) {
        localStorage.setItem('gostaylo_original_admin', currentUser);
      }
    }

    const impersonatedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      isImpersonated: true
    };
    
    localStorage.setItem('gostaylo_user', JSON.stringify(impersonatedUser));
    toast.success(`Вы вошли как ${user.name}`);
    
    if (user.role === 'PARTNER') {
      window.location.href = '/partner/dashboard';
    } else {
      window.location.href = '/';
    }
  };

  const handleVerifyIdentity = async (newStatus) => {
    setVerifying(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId,
          updates: { 
            is_verified: newStatus === 'APPROVED',
            verification_status: newStatus
          }
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(newStatus === 'APPROVED' ? 'Личность подтверждена!' : 'Статус обновлён');
        setUser(prev => ({ 
          ...prev, 
          isVerified: newStatus === 'APPROVED',
          verificationStatus: newStatus 
        }));
      } else {
        throw new Error(data.error || 'Failed to update');
      }
    } catch (error) {
      toast.error('Не удалось обновить статус верификации');
    } finally {
      setVerifying(false);
    }
  };

  // Helper to format Telegram link correctly
  const getTelegramLink = (username) => {
    if (!username) return null;
    // Remove @ if present
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    return `https://t.me/${cleanUsername}`;
  };

  const getRoleBadge = (role) => {
    const styles = {
      ADMIN: 'bg-red-100 text-red-800 border-red-300',
      MODERATOR: 'bg-orange-100 text-orange-800 border-orange-300',
      PARTNER: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      RENTER: 'bg-green-100 text-green-800 border-green-300',
    };
    return styles[role] || 'bg-gray-100 text-gray-800';
  };

  const getVerificationBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Верифицирован</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />На проверке</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Отклонён</Badge>;
      default:
        return <Badge variant="outline">Не подтверждён</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Пользователь не найден</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
      </div>
    );
  }

  const effectiveCommission =
    user.customCommissionRate != null ? user.customCommissionRate : systemCommission;

  return (
    <div className="space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/users')}>
            <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Назад</span>
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Профиль пользователя</h1>
        </div>
        {(user.role === 'PARTNER' || user.role === 'RENTER') && (
          <Button 
            onClick={handleLoginAs} 
            variant="outline" 
            size="sm"
            className="text-indigo-600 w-full sm:w-auto sm:ml-auto"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Войти как этот пользователь
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Основная информация
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {user.name?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{user.name || 'Без имени'}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getRoleBadge(user.role)}>{user.role}</Badge>
                    {getVerificationBadge(user.verificationStatus)}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <p className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {user.email}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Телефон</Label>
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {user.phone || 'Не указан'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Telegram</Label>
                  <p className="flex items-center gap-2">
                    {user.telegramUsername ? (
                      <a 
                        href={getTelegramLink(user.telegramUsername)} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        @{user.telegramUsername.replace('@', '')}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    ) : user.telegramId ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Привязан (ID: {user.telegramId})
                      </span>
                    ) : (
                      <span className="text-gray-400">Не привязан</span>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Дата регистрации</Label>
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : 'N/A'}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Role Management */}
              <div>
                <Label className="text-sm font-medium">Изменить роль</Label>
                <Select value={user.role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-full md:w-48 mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RENTER">Renter</SelectItem>
                    <SelectItem value="PARTNER">Partner</SelectItem>
                    <SelectItem value="MODERATOR">Moderator</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Identity Verification Card */}
          <Card className={`border-2 ${
            user.verificationStatus === 'APPROVED' ? 'border-green-200' : 
            user.verificationStatus === 'PENDING' ? 'border-yellow-200' : 'border-gray-200'
          }`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Верификация личности
              </CardTitle>
              <CardDescription>
                Проверка документов пользователя
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <span className="text-sm font-medium">Текущий статус:</span>
                {user.verificationStatus === 'APPROVED' ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Верифицирован
                  </Badge>
                ) : user.verificationStatus === 'PENDING' ? (
                  <Badge className="bg-yellow-100 text-yellow-800">
                    <Clock className="w-3 h-3 mr-1" />
                    На проверке
                  </Badge>
                ) : user.verificationStatus === 'REJECTED' ? (
                  <Badge className="bg-red-100 text-red-800">
                    <XCircle className="w-3 h-3 mr-1" />
                    Отклонён
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-600">
                    <Clock className="w-3 h-3 mr-1" />
                    Ожидает верификации
                  </Badge>
                )}
              </div>

              {/* Verification Documents Preview */}
              {(kycDocs.length > 0 || user.verificationDocUrl) && (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Загруженные документы</Label>
                  <div className="flex flex-wrap gap-2">
                    {kycDocs[0]?.document_url && (
                      <a 
                        href={toAdminVerificationDocProxyUrl(kycDocs[0].document_url)} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        <ProxiedImage 
                          src={toAdminVerificationDocProxyUrl(kycDocs[0].document_url)} 
                          alt="Документ"
                          width={96}
                          height={64}
                          className="object-cover"
                        />
                      </a>
                    )}
                    {kycDocs[0]?.selfie_url && (
                      <a 
                        href={toAdminVerificationDocProxyUrl(kycDocs[0].selfie_url)} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        <ProxiedImage 
                          src={toAdminVerificationDocProxyUrl(kycDocs[0].selfie_url)} 
                          alt="Селфи"
                          width={96}
                          height={64}
                          className="object-cover"
                        />
                      </a>
                    )}
                    {user.verificationDocUrl && !kycDocs[0]?.document_url && (
                      <a 
                        href={toAdminVerificationDocProxyUrl(user.verificationDocUrl)} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        <ProxiedImage 
                          src={toAdminVerificationDocProxyUrl(user.verificationDocUrl)} 
                          alt="Документ"
                          width={96}
                          height={64}
                          className="object-cover"
                        />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {user.verificationStatus !== 'APPROVED' && (
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button 
                    onClick={() => handleVerifyIdentity('APPROVED')}
                    disabled={verifying}
                    className="bg-green-600 hover:bg-green-700 flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {verifying ? 'Обработка...' : 'Подтвердить личность'}
                  </Button>
                  {user.verificationStatus !== 'REJECTED' && (
                    <Button 
                      onClick={() => handleVerifyIdentity('REJECTED')}
                      disabled={verifying}
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 flex-1 sm:flex-none"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Отклонить
                    </Button>
                  )}
                </div>
              )}

              {user.verificationStatus === 'APPROVED' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-800">Личность пользователя подтверждена администратором</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Commission Card - Only for Partners */}
          {user.role === 'PARTNER' && (
            <Card className="border-2 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5 text-green-600" />
                  Настройки комиссии
                </CardTitle>
                <CardDescription>
                  Персональная ставка комиссии для этого партнёра
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Системная комиссия:</span>
                    <span className="font-semibold">
                      {systemCommission != null ? `${systemCommission}%` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Персональная комиссия:</span>
                    <span className="font-semibold text-green-600">
                      {user.customCommissionRate !== null ? `${user.customCommissionRate}%` : 'Не установлена'}
                    </span>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Действующая ставка:</span>
                    <span className="text-xl font-bold text-indigo-600">
                      {effectiveCommission != null ? `${effectiveCommission}%` : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label htmlFor="commission" className="text-sm">Установить персональную комиссию (%)</Label>
                    <Input
                      id="commission"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="Оставьте пустым для системной ставки"
                      value={customCommission}
                      onChange={(e) => setCustomCommission(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <Button 
                    onClick={handleSaveCommission} 
                    disabled={saving}
                    className="mt-6 bg-green-600 hover:bg-green-700"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </div>

                <p className="text-xs text-gray-500">
                  Партнёр получит {100 - effectiveCommission}% от стоимости бронирования
                </p>
              </CardContent>
            </Card>
          )}

          {/* KYC Documents */}
          {kycDocs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-600" />
                  KYC Документы ({kycDocs.length})
                </CardTitle>
                <CardDescription>
                  Документы верификации партнёра
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {kycDocs.map((doc, index) => (
                  <div key={doc.id || index} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={
                            doc.status === 'APPROVED' ? 'default' :
                            doc.status === 'PENDING' ? 'secondary' : 'destructive'
                          }>
                            {doc.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                        
                        {doc.company_name && (
                          <p className="text-sm"><strong>Компания:</strong> {doc.company_name}</p>
                        )}
                        {doc.experience && (
                          <p className="text-sm"><strong>Опыт:</strong> {doc.experience}</p>
                        )}
                        {doc.rejection_reason && (
                          <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                            <p className="text-sm text-red-700">
                              <AlertTriangle className="w-4 h-4 inline mr-1" />
                              Причина отклонения: {doc.rejection_reason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Document Images */}
                    {(doc.document_url || doc.selfie_url) && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {doc.document_url && (
                          <a 
                            href={toAdminVerificationDocProxyUrl(doc.document_url)} 
                            target="_blank"
                            className="block border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                          >
                            <ProxiedImage 
                              src={toAdminVerificationDocProxyUrl(doc.document_url)} 
                              alt="Документ"
                              width={160}
                              height={112}
                              className="object-cover"
                            />
                            <p className="text-xs text-center py-1 bg-gray-100">Документ</p>
                          </a>
                        )}
                        {doc.selfie_url && (
                          <a 
                            href={toAdminVerificationDocProxyUrl(doc.selfie_url)} 
                            target="_blank"
                            className="block border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                          >
                            <ProxiedImage 
                              src={toAdminVerificationDocProxyUrl(doc.selfie_url)} 
                              alt="Селфи"
                              width={160}
                              height={112}
                              className="object-cover"
                            />
                            <p className="text-xs text-center py-1 bg-gray-100">Селфи</p>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Legacy Verification Document */}
          {user.verificationDocUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                  Документ верификации (Legacy)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a 
                  href={toAdminVerificationDocProxyUrl(user.verificationDocUrl)} 
                  target="_blank"
                  className="block border rounded-lg overflow-hidden hover:shadow-lg transition-shadow w-fit"
                >
                  <ProxiedImage 
                    src={toAdminVerificationDocProxyUrl(user.verificationDocUrl)} 
                    alt="Verification document"
                    width={448}
                    height={320}
                    className="max-w-sm h-auto object-contain"
                  />
                </a>
                {user.verificationDocType && (
                  <p className="text-sm text-gray-500 mt-2">Тип: {user.verificationDocType}</p>
                )}
                {user.verificationSubmittedAt && (
                  <p className="text-sm text-gray-500">
                    Загружен: {new Date(user.verificationSubmittedAt).toLocaleDateString('ru-RU')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Balance Card - Partners only */}
          {user.role === 'PARTNER' && (
            <Card className="border-2 border-indigo-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-indigo-600" />
                  Баланс
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-indigo-600">
                  {(user.availableBalance || 0).toLocaleString()} ₿
                </p>
                <p className="text-xs text-gray-500 mt-1">Доступно к выводу</p>
              </CardContent>
            </Card>
          )}

          {/* Listings - Partners only */}
          {user.role === 'PARTNER' && listings.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-600" />
                  Объекты ({listings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {listings.map(listing => (
                  <Link 
                    key={listing.id}
                    href={`/listings/${listing.id}`}
                    className="block p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate flex-1">
                        {listing.title || 'Без названия'}
                      </span>
                      <Badge variant="outline" className="text-xs ml-2">
                        {listing.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {listing.price_per_day?.toLocaleString()} ₿/день
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Статистика</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">ID пользователя</span>
                <span className="font-mono text-xs">{user.id?.slice(0, 8)}...</span>
              </div>
              {user.role === 'PARTNER' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Объектов</span>
                    <span className="font-semibold">{listings.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Комиссия</span>
                    <span className="font-semibold text-green-600">{effectiveCommission}%</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
