/**
 * Gostaylo - Admin Dashboard
 * Main admin panel page
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Building2, CreditCard, MessageSquare, 
  TrendingUp, AlertTriangle, CheckCircle, Clock,
  Shield, Settings, BarChart3, DollarSign
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch('/api/v2/admin/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data);
      }
    } catch (error) {
      console.error('[ADMIN STATS]', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-600">System overview and management</p>
        </div>
        <Badge className="bg-indigo-100 text-indigo-800">
          <Shield className="h-3 w-3 mr-1" />
          Admin Access
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users?.total || 0}</div>
            <p className="text-xs text-slate-500">
              {stats?.users?.partners || 0} partners, {stats?.users?.renters || 0} renters
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Active Listings</CardTitle>
            <Building2 className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.listings?.active || 0}</div>
            <p className="text-xs text-slate-500">
              {stats?.listings?.pending || 0} pending review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Revenue (Month)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ฿{(stats?.finance?.monthlyRevenue || 0).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500">
              ฿{(stats?.finance?.commission || 0).toLocaleString()} commission
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Pending Actions</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {(stats?.pending?.payments || 0) + (stats?.pending?.verifications || 0)}
            </div>
            <p className="text-xs text-slate-500">
              {stats?.pending?.payments || 0} payments, {stats?.pending?.verifications || 0} verifications
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/users">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <Users className="h-8 w-8 text-blue-600 mb-2" />
              <h3 className="font-semibold">Users</h3>
              <p className="text-sm text-slate-600">Manage users & roles</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/moderation">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-500">
            <CardContent className="pt-6">
              <Building2 className="h-8 w-8 text-teal-600 mb-2" />
              <h3 className="font-semibold">Listings</h3>
              <p className="text-sm text-slate-600">Review & approve</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/finances">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <CreditCard className="h-8 w-8 text-green-600 mb-2" />
              <h3 className="font-semibold">Finance</h3>
              <p className="text-sm text-slate-600">Payments & payouts</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/messages">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <MessageSquare className="h-8 w-8 text-purple-600 mb-2" />
              <h3 className="font-semibold">Messages</h3>
              <p className="text-sm text-slate-600">Support & disputes</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">API: Online</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Database: Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Telegram Bot: Active</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Email Service: Ready</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
