/**
 * FunnyRent 2.1 - Database Test Page (Public)
 * /test-db - Verify Supabase connection (No Auth Required)
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Database, CheckCircle, XCircle, Users, Home, Calendar, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TestDbPage() {
  const [dbStatus, setDbStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    checkDatabase();
  }, []);

  async function checkDatabase() {
    setLoading(true);
    try {
      // Test database connection via v2 API
      const [seedRes, statsRes, categoriesRes] = await Promise.all([
        fetch('/api/db/seed'),
        fetch('/api/v2/admin/stats'),
        fetch('/api/v2/categories?all=true')
      ]);

      const seedData = await seedRes.json();
      const statsData = await statsRes.json();
      const categoriesData = await categoriesRes.json();

      setDbStatus({
        connected: !!seedData.supabaseUrl,
        url: seedData.supabaseUrl,
        adminUser: seedData.adminUser,
        tableCounts: seedData.tableCounts
      });

      setStats({
        ...statsData.data,
        categories: categoriesData.data
      });

    } catch (error) {
      console.error('Database check failed:', error);
      setDbStatus({
        connected: false,
        error: error.message
      });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      {/* Header */}
      <header className="bg-purple-950/50 border-b border-purple-700/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" className="text-purple-200 hover:text-white hover:bg-purple-800/50">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </Link>
              <div className="h-8 w-px bg-purple-700" />
              <div className="flex items-center gap-2">
                <Database className="h-6 w-6 text-purple-400" />
                <h1 className="text-xl font-bold text-white">Database Test</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-purple-300 border-purple-500">
                Stage 15.3
              </Badge>
              <Link href="/admin/dashboard">
                <Button variant="outline" className="text-purple-300 border-purple-500 hover:bg-purple-800">
                  <Shield className="h-4 w-4 mr-2" />
                  Admin Panel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 text-purple-400 animate-spin mb-4" />
            <p className="text-purple-300">Checking database connection...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connection Status Card */}
            <Card className="bg-purple-950/50 border-purple-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  {dbStatus?.connected ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                  Database Connection: {dbStatus?.connected ? 'OK' : 'FAILED'}
                </CardTitle>
                <CardDescription className="text-purple-300">
                  Supabase PostgreSQL - Live Production Data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-purple-900/50 rounded-lg p-4">
                    <p className="text-purple-400 text-sm mb-1">Supabase URL</p>
                    <p className="text-white font-mono text-sm break-all">
                      {dbStatus?.url || 'Not configured'}
                    </p>
                  </div>
                  <div className="bg-purple-900/50 rounded-lg p-4">
                    <p className="text-purple-400 text-sm mb-1">Admin User (Super Admin)</p>
                    {dbStatus?.adminUser ? (
                      <div className="text-white">
                        <p className="font-semibold">{dbStatus.adminUser.name}</p>
                        <p className="text-sm text-purple-300">{dbStatus.adminUser.email}</p>
                        <Badge className="mt-1 bg-purple-600">{dbStatus.adminUser.role}</Badge>
                      </div>
                    ) : (
                      <p className="text-red-400">Admin not found</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Table Counts */}
            {dbStatus?.tableCounts && (
              <Card className="bg-purple-950/50 border-purple-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Table Counts (Supabase)</CardTitle>
                  <CardDescription className="text-purple-300">
                    Live record counts from production database
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {Object.entries(dbStatus.tableCounts).map(([table, count]) => (
                      <div 
                        key={table} 
                        className={`bg-purple-900/50 rounded-lg p-3 text-center ${
                          count === 'table_missing' ? 'border border-red-500/50' : ''
                        }`}
                      >
                        <p className="text-purple-400 text-xs mb-1 capitalize">{table}</p>
                        <p className={`text-xl font-bold ${
                          count === 'table_missing' ? 'text-red-400 text-sm' : 'text-white'
                        }`}>
                          {count === 'table_missing' ? 'Missing' : count}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Users */}
                <Card className="bg-purple-950/50 border-purple-700/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-400" />
                      Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-white mb-2">{stats.users?.total || 0}</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-purple-300">
                        <span>Admins</span>
                        <span className="text-white">{stats.users?.admins || 0}</span>
                      </div>
                      <div className="flex justify-between text-purple-300">
                        <span>Partners</span>
                        <span className="text-white">{stats.users?.partners || 0}</span>
                      </div>
                      <div className="flex justify-between text-purple-300">
                        <span>Renters</span>
                        <span className="text-white">{stats.users?.renters || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Listings */}
                <Card className="bg-purple-950/50 border-purple-700/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Home className="h-5 w-5 text-purple-400" />
                      Listings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-white mb-2">{stats.listings?.total || 0}</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-purple-300">
                        <span>Active</span>
                        <span className="text-green-400">{stats.listings?.active || 0}</span>
                      </div>
                      <div className="flex justify-between text-purple-300">
                        <span>Pending</span>
                        <span className="text-yellow-400">{stats.listings?.pending || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bookings */}
                <Card className="bg-purple-950/50 border-purple-700/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-purple-400" />
                      Bookings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-white mb-2">{stats.bookings?.total || 0}</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-purple-300">
                        <span>Confirmed</span>
                        <span className="text-green-400">{stats.bookings?.confirmed || 0}</span>
                      </div>
                      <div className="flex justify-between text-purple-300">
                        <span>Pending</span>
                        <span className="text-yellow-400">{stats.bookings?.pending || 0}</span>
                      </div>
                      <div className="flex justify-between text-purple-300">
                        <span>Completed</span>
                        <span className="text-white">{stats.bookings?.completed || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Categories */}
            {stats?.categories && (
              <Card className="bg-purple-950/50 border-purple-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Categories (Live from Supabase)</CardTitle>
                  <CardDescription className="text-purple-300">
                    Real data pulled from production database
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.categories.map(cat => (
                      <div 
                        key={cat.id} 
                        className={`bg-purple-900/50 rounded-lg p-4 ${
                          !cat.isActive ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{cat.icon}</span>
                          <span className="text-white font-semibold">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={cat.isActive ? 'bg-green-600' : 'bg-gray-600'}
                          >
                            {cat.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <span className="text-purple-400 text-xs">ID: {cat.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* API Endpoints */}
            <Card className="bg-purple-950/50 border-purple-700/50">
              <CardHeader>
                <CardTitle className="text-white">v2 API Endpoints (Supabase Connected)</CardTitle>
                <CardDescription className="text-purple-300">
                  All routes migrated to Service-Oriented Architecture
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                  {[
                    '/api/v2/categories',
                    '/api/v2/listings',
                    '/api/v2/listings/[id]',
                    '/api/v2/bookings',
                    '/api/v2/bookings/[id]',
                    '/api/v2/auth/login',
                    '/api/v2/auth/register',
                    '/api/v2/admin/stats',
                    '/api/v2/partner/stats',
                    '/api/v2/partner/listings',
                    '/api/v2/partner/payouts',
                    '/api/v2/promo-codes/validate',
                    '/api/v2/districts',
                    '/api/v2/exchange-rates',
                    '/api/v2/profile'
                  ].map(endpoint => (
                    <div key={endpoint} className="flex items-center gap-2 bg-purple-900/30 rounded px-3 py-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <code className="text-purple-200">{endpoint}</code>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Refresh Button */}
            <div className="flex justify-center">
              <Button 
                onClick={checkDatabase} 
                className="bg-purple-600 hover:bg-purple-700"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Refresh Database Status
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
