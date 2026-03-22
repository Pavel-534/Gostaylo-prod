/**
 * Gostaylo - Admin Database Test Page
 * /admin/test-db - Verify Supabase connection
 * Uses direct Supabase client (bypasses Kubernetes routing)
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Database, CheckCircle, XCircle, Users, Home, Calendar, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  fetchDatabaseStatus, 
  fetchAdminUser, 
  fetchAdminStats, 
  fetchAllCategories 
} from '@/lib/client-data';

export default function AdminTestDbPage() {
  const [dbStatus, setDbStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    checkDatabase();
  }, []);

  async function checkDatabase() {
    setLoading(true);
    try {
      // Fetch all data directly from Supabase
      const [statusData, adminUser, statsData, categories] = await Promise.all([
        fetchDatabaseStatus(),
        fetchAdminUser(),
        fetchAdminStats(),
        fetchAllCategories()
      ]);

      setDbStatus({
        connected: !!statusData.dataProxyBase && !Object.values(statusData.tableCounts).every(v => v === 'error'),
        url: statusData.dataProxyBase,
        adminUser: adminUser,
        tableCounts: statusData.tableCounts
      });

      setStats({
        ...statsData,
        categories: categories
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
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" className="text-purple-200 hover:text-white hover:bg-purple-800/50">
                  <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Admin Panel</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              <div className="h-6 w-px bg-purple-700 hidden sm:block" />
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                <h1 className="text-lg sm:text-xl font-bold text-white">Database Test</h1>
              </div>
            </div>
            <Badge variant="outline" className="text-purple-300 border-purple-500 text-xs sm:text-sm">
              Stage 15.3
            </Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-purple-400 animate-spin mb-4" />
            <p className="text-purple-300 text-sm sm:text-base">Checking database connection...</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Connection Status Card */}
            <Card className="bg-purple-950/50 border-purple-700/50">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
                  {dbStatus?.connected ? (
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 flex-shrink-0" />
                  )}
                  <span>Database Connection: {dbStatus?.connected ? 'OK' : 'FAILED'}</span>
                </CardTitle>
                <CardDescription className="text-purple-300 text-sm">
                  Supabase PostgreSQL (Direct Client)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-purple-900/50 rounded-lg p-3 sm:p-4">
                    <p className="text-purple-400 text-xs sm:text-sm mb-1">Supabase URL</p>
                    <p className="text-white font-mono text-xs sm:text-sm break-all">
                      {dbStatus?.url || 'Not configured'}
                    </p>
                  </div>
                  <div className="bg-purple-900/50 rounded-lg p-3 sm:p-4">
                    <p className="text-purple-400 text-xs sm:text-sm mb-1">Admin User</p>
                    {dbStatus?.adminUser ? (
                      <div className="text-white">
                        <p className="font-semibold text-sm sm:text-base">{dbStatus.adminUser.name}</p>
                        <p className="text-xs sm:text-sm text-purple-300">{dbStatus.adminUser.email}</p>
                        <Badge className="mt-1 bg-purple-600 text-xs">{dbStatus.adminUser.role}</Badge>
                      </div>
                    ) : (
                      <p className="text-red-400 text-sm">Admin not found</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Table Counts */}
            {dbStatus?.tableCounts && (
              <Card className="bg-purple-950/50 border-purple-700/50">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-white text-base sm:text-lg">Table Counts</CardTitle>
                  <CardDescription className="text-purple-300 text-sm">
                    Records in each Supabase table
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
                    {Object.entries(dbStatus.tableCounts).map(([table, count]) => (
                      <div 
                        key={table} 
                        className={`bg-purple-900/50 rounded-lg p-2 sm:p-3 text-center ${
                          count === 'error' ? 'border border-red-500/50' : ''
                        }`}
                      >
                        <p className="text-purple-400 text-[10px] sm:text-xs mb-1 capitalize truncate">{table}</p>
                        <p className={`text-lg sm:text-xl font-bold ${
                          count === 'error' ? 'text-red-400 text-xs sm:text-sm' : 'text-white'
                        }`}>
                          {count === 'error' ? 'Error' : count}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Users */}
                <Card className="bg-purple-950/50 border-purple-700/50">
                  <CardHeader className="p-4 sm:p-6 pb-2">
                    <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                      Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    <div className="text-3xl sm:text-4xl font-bold text-white mb-2">{stats.users?.total || 0}</div>
                    <div className="space-y-1 text-xs sm:text-sm">
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
                  <CardHeader className="p-4 sm:p-6 pb-2">
                    <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
                      <Home className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                      Listings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    <div className="text-3xl sm:text-4xl font-bold text-white mb-2">{stats.listings?.total || 0}</div>
                    <div className="space-y-1 text-xs sm:text-sm">
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
                  <CardHeader className="p-4 sm:p-6 pb-2">
                    <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                      Bookings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    <div className="text-3xl sm:text-4xl font-bold text-white mb-2">{stats.bookings?.total || 0}</div>
                    <div className="space-y-1 text-xs sm:text-sm">
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
            {stats?.categories && stats.categories.length > 0 && (
              <Card className="bg-purple-950/50 border-purple-700/50">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-white text-base sm:text-lg">Categories from Supabase</CardTitle>
                  <CardDescription className="text-purple-300 text-sm">
                    Live data from the database
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {stats.categories.map(cat => (
                      <div 
                        key={cat.id} 
                        className={`bg-purple-900/50 rounded-lg p-3 sm:p-4 ${
                          !cat.isActive ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl sm:text-2xl">{cat.icon}</span>
                          <span className="text-white font-semibold text-sm sm:text-base">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            className={`text-xs ${cat.isActive ? 'bg-green-600' : 'bg-gray-600'}`}
                          >
                            {cat.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <span className="text-purple-400 text-[10px] sm:text-xs">ID: {cat.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
                  <RefreshCw className="h-4 w-4 mr-2" />
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
