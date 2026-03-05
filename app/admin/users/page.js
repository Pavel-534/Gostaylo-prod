'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, User, Users as UsersIcon, Search, Mail, Phone, LogIn, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, roleFilter, users]);

  const loadUsers = async () => {
    try {
      // Direct Supabase call to avoid k8s routing issues
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&order=created_at.desc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        const formattedUsers = data.map(u => ({
          id: u.id,
          email: u.email,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
          firstName: u.first_name,
          lastName: u.last_name,
          role: u.last_name?.includes('[MODERATOR]') ? 'MODERATOR' : u.role,
          isVerified: u.is_verified,
          verificationStatus: u.verification_status,
          customCommissionRate: u.custom_commission_rate,
          availableBalance: u.available_balance,
          phone: u.phone,
          telegramId: u.telegram_id,
          createdAt: u.created_at
        }));
        setUsers(formattedUsers);
        setFilteredUsers(formattedUsers);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  // Login as another user (impersonation)
  const handleLoginAs = (targetUser) => {
    // Save original admin for return
    const currentUser = localStorage.getItem('gostaylo_user');
    if (currentUser) {
      const parsed = JSON.parse(currentUser);
      if (!parsed.isImpersonated) {
        localStorage.setItem('gostaylo_original_admin', currentUser);
      }
    }

    const impersonatedUser = {
      id: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      name: targetUser.name,
      isModerator: targetUser.role === 'MODERATOR' || (targetUser.lastName && targetUser.lastName.includes('[MODERATOR]')),
      isImpersonated: true
    };
    
    localStorage.setItem('gostaylo_user', JSON.stringify(impersonatedUser));
    toast.success(`Вы вошли как ${targetUser.name}`);
    
    // Force full page reload to update all UI state immediately
    if (targetUser.role === 'PARTNER') {
      window.location.href = '/partner/dashboard';
    } else if (targetUser.role === 'RENTER') {
      window.location.href = '/';
    } else if (targetUser.role === 'MODERATOR' || (targetUser.lastName && targetUser.lastName.includes('[MODERATOR]'))) {
      window.location.href = '/admin/dashboard';
    } else {
      window.location.href = '/admin/dashboard';
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (roleFilter !== 'ALL') {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (u) =>
          u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        toast.success(`Роль обновлена на ${newRole}`);
        loadUsers();
      }
    } catch (error) {
      toast.error('Не удалось обновить роль');
    }
  };

  const handleCommissionChange = async (partnerId, customRate) => {
    try {
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${partnerId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          custom_commission_rate: customRate === '' ? null : parseFloat(customRate) 
        }),
      });

      if (res.ok) {
        toast.success(customRate ? `Комиссия: ${customRate}%` : 'Используется глобальная ставка');
        loadUsers();
      }
    } catch (error) {
      toast.error('Не удалось обновить комиссию');
    }
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

  const getRoleIcon = (role) => {
    switch (role) {
      case 'ADMIN':
        return <Shield className="w-4 h-4" />;
      case 'PARTNER':
        return <UsersIcon className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
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
    <div className="space-y-4 lg:space-y-6 max-w-full overflow-hidden">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words">
          Управление пользователями
        </h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">Все пользователи платформы</p>
      </div>

      {/* Stats - Stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-6">
        <Card className="border-2 border-red-100">
          <CardContent className="p-4">
            <p className="text-xs lg:text-sm text-gray-600">Администраторы</p>
            <p className="text-2xl lg:text-3xl font-bold text-red-600 mt-1">
              {users.filter((u) => u.role === 'ADMIN').length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-indigo-100">
          <CardContent className="p-4">
            <p className="text-xs lg:text-sm text-gray-600">Партнеры</p>
            <p className="text-2xl lg:text-3xl font-bold text-indigo-600 mt-1">
              {users.filter((u) => u.role === 'PARTNER').length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-100">
          <CardContent className="p-4">
            <p className="text-xs lg:text-sm text-gray-600">Арендаторы</p>
            <p className="text-2xl lg:text-3xl font-bold text-green-600 mt-1">
              {users.filter((u) => u.role === 'RENTER').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Поиск по email или имени..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Фильтр по роли" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все роли</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MODERATOR">Moderator</SelectItem>
                <SelectItem value="PARTNER">Partner</SelectItem>
                <SelectItem value="RENTER">Renter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="shadow-lg lg:shadow-xl">
        <CardHeader className="pb-2 lg:pb-4">
          <CardTitle className="text-base lg:text-lg">
            Пользователи ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 lg:p-6">
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="p-3 lg:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all"
              >
                {/* Mobile Layout */}
                <div className="flex flex-col lg:hidden gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm truncate">{user.name || 'No name'}</p>
                        <Badge className={`${getRoleBadge(user.role)} text-xs px-1.5 py-0`}>
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  
                  {/* Mobile Actions Row */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                    {(user.role === 'PARTNER' || user.role === 'RENTER' || user.role === 'MODERATOR') ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 h-8 text-xs flex-1"
                        onClick={() => handleLoginAs(user)}
                        data-testid={`login-as-${user.id}-mobile`}
                      >
                        <LogIn className="w-3 h-3 mr-1" />
                        Войти как
                      </Button>
                    ) : (
                      <div className="flex-1" />
                    )}
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value)}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
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
                </div>

                {/* Desktop Layout */}
                <div className="hidden lg:flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900">{user.name || 'No name'}</p>
                        <Badge className={`${getRoleBadge(user.role)} flex items-center gap-1`}>
                          {getRoleIcon(user.role)}
                          {user.role}
                        </Badge>
                        {user.isVerified && (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            ✓ Verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {user.email}
                        </span>
                        {user.createdAt && (
                          <span className="text-xs text-gray-500">
                            Joined: {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                          </span>
                        )}
                      </div>
                      {/* Custom Commission for Partners */}
                      {user.role === 'PARTNER' && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-600">Комиссия:</span>
                          <Input
                            type="number"
                            placeholder="Глоб."
                            defaultValue={user.customCommissionRate || ''}
                            onBlur={(e) => handleCommissionChange(user.id, e.target.value)}
                            className="w-20 h-7 text-xs"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                          <span className="text-xs text-gray-500">
                            % (пусто = глобальная 15%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right mr-4">
                      {user.role === 'PARTNER' && (
                        <div>
                          <p className="text-sm text-gray-600">Balance</p>
                          <p className="font-semibold text-indigo-600">
                            {user.availableBalance?.toLocaleString() || '0'} ₿
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Login As Button - for Partners, Renters, and Moderators */}
                    {(user.role === 'PARTNER' || user.role === 'RENTER' || user.role === 'MODERATOR') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        onClick={() => handleLoginAs(user)}
                        data-testid={`login-as-${user.id}`}
                      >
                        <LogIn className="w-4 h-4 mr-1" />
                        Login as
                      </Button>
                    )}
                    
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value)}
                    >
                      <SelectTrigger className="w-32">
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
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
