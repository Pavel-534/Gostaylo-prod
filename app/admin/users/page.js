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
  const handleLoginAs = (user) => {
    const impersonatedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      isModerator: user.role === 'MODERATOR',
      isImpersonated: true
    };
    
    localStorage.setItem('funnyrent_user', JSON.stringify(impersonatedUser));
    toast.success(`Вы вошли как ${user.name}`);
    
    // Redirect based on role
    if (user.role === 'PARTNER') {
      router.push('/partner/dashboard');
    } else if (user.role === 'RENTER') {
      router.push('/');
    } else {
      router.push('/admin/dashboard');
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
      const res = await fetch(`/api/admin/partners/${partnerId}/commission`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customCommissionRate: customRate === '' ? null : parseFloat(customRate) }),
      });

      if (res.ok) {
        toast({
          title: '✅ Комиссия обновлена',
          description: customRate ? `Индивидуальная ставка: ${customRate}%` : 'Используется глобальная ставка',
        });
        loadUsers();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить комиссию',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      ADMIN: 'bg-red-100 text-red-800 border-red-300',
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Управление пользователями</h1>
        <p className="text-gray-600 mt-1">Все пользователи платформы FunnyRent</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Администраторы</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {users.filter((u) => u.role === 'ADMIN').length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-indigo-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Партнеры</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">
              {users.filter((u) => u.role === 'PARTNER').length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Арендаторы</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {users.filter((u) => u.role === 'RENTER').length}
            </div>
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
                <SelectItem value="PARTNER">Partner</SelectItem>
                <SelectItem value="RENTER">Renter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>
            Пользователи ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border-2 border-gray-200 transition-all"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
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
                <div className="flex items-center gap-3">
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
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
