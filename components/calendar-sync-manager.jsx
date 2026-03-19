'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  Link2, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, 
  AlertCircle, ExternalLink, Calendar, Clock, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const PLATFORMS = [
  { value: 'Airbnb', label: 'Airbnb', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'Booking.com', label: 'Booking.com', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'VRBO', label: 'VRBO', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'Google Calendar', label: 'Google Calendar', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'Custom', label: 'Другой', color: 'bg-slate-100 text-slate-700 border-slate-200' }
]

function detectPlatform(url) {
  if (!url) return 'Custom'
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('airbnb')) return 'Airbnb'
  if (lowerUrl.includes('booking.com')) return 'Booking.com'
  if (lowerUrl.includes('vrbo') || lowerUrl.includes('homeaway')) return 'VRBO'
  if (lowerUrl.includes('google.com') || lowerUrl.includes('calendar.google')) return 'Google Calendar'
  return 'Custom'
}

function getPlatformBadge(platform) {
  const config = PLATFORMS.find(p => p.value === platform) || PLATFORMS[4]
  return <Badge className={`${config.color} border`}>{config.label}</Badge>
}

export default function CalendarSyncManager({ listingId, onSync }) {
  const [syncSettings, setSyncSettings] = useState({
    sources: [],
    auto_sync: false,
    sync_interval_hours: 24,
    last_sync: null
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingSourceId, setSyncingSourceId] = useState(null)
  const [blockedDates, setBlockedDates] = useState([])
  
  // New source form
  const [newUrl, setNewUrl] = useState('')
  const [newPlatform, setNewPlatform] = useState('')
  const [addingSource, setAddingSource] = useState(false)
  
  useEffect(() => {
    if (listingId) {
      loadSyncSettings()
      loadBlockedDates()
    }
  }, [listingId])
  
  async function loadSyncSettings() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=sync_settings,metadata`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await res.json()
      const listing = data?.[0]
      
      if (listing) {
        // Prefer sync_settings column, fallback to metadata.sync_settings
        let settings = listing.sync_settings || {}
        
        // Migration: if sync_settings is empty but metadata has data, use metadata
        if ((!settings.sources || settings.sources.length === 0) && listing.metadata?.sync_settings) {
          settings = {
            sources: listing.metadata.sync_settings,
            auto_sync: listing.metadata.auto_sync || false,
            sync_interval_hours: listing.metadata.sync_interval_hours || 24,
            last_sync: listing.metadata.last_ical_sync
          }
        }
        
        // Ensure structure
        setSyncSettings({
          sources: settings.sources || [],
          auto_sync: settings.auto_sync || false,
          sync_interval_hours: settings.sync_interval_hours || 24,
          last_sync: settings.last_sync || null
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load sync settings:', error)
      setLoading(false)
    }
  }
  
  async function loadBlockedDates() {
    try {
      const res = await fetch(`/api/v2/partner/listings/${listingId}/calendar`, { credentials: 'include' })
      const json = await res.json()
      if (!json.success || !json.blocks) {
        setBlockedDates([])
        return
      }
      // Map calendar_blocks to display format; show only iCal blocks (source != 'manual')
      const icalBlocks = (json.blocks || []).filter(b => b.source && b.source !== 'manual')
      const mapped = icalBlocks.map(b => ({
        id: b.id,
        check_in: b.start_date,
        check_out: b.end_date,
        guest_name: b.reason || ''
      }))
      setBlockedDates(mapped)
    } catch (error) {
      console.error('Failed to load blocked dates:', error)
      setBlockedDates([])
    }
  }
  
  async function saveSyncSettings(newSettings) {
    setSaving(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          sync_settings: newSettings,
          updated_at: new Date().toISOString()
        })
      })
      
      if (res.ok) {
        setSyncSettings(newSettings)
        toast.success('Настройки сохранены')
      } else {
        toast.error('Ошибка сохранения')
      }
    } catch (error) {
      console.error('Failed to save sync settings:', error)
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }
  
  async function handleAddSource() {
    if (!newUrl.trim()) {
      toast.error('Введите URL календаря')
      return
    }
    
    if (!newUrl.startsWith('http')) {
      toast.error('URL должен начинаться с http:// или https://')
      return
    }
    
    // Check for duplicates
    if (syncSettings.sources.some(s => s.url === newUrl)) {
      toast.error('Этот URL уже добавлен')
      return
    }
    
    setAddingSource(true)
    
    try {
      // Test the URL first
      const testRes = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse', url: newUrl })
      })
      const testData = await testRes.json()
      
      if (!testData.success) {
        toast.error(`Ошибка: ${testData.error || 'Не удалось загрузить календарь'}`)
        setAddingSource(false)
        return
      }
      
      const platform = newPlatform || detectPlatform(newUrl)
      
      const newSource = {
        id: `src-${Date.now().toString(36)}`,
        url: newUrl,
        platform: platform,
        enabled: true,
        added_at: new Date().toISOString(),
        status: 'active',
        last_sync: null,
        events_count: testData.futureEvents || 0
      }
      
      const newSettings = {
        ...syncSettings,
        sources: [...syncSettings.sources, newSource]
      }
      
      await saveSyncSettings(newSettings)
      
      toast.success(`✅ Добавлен ${platform} (${testData.futureEvents || 0} событий)`)
      setNewUrl('')
      setNewPlatform('')
    } catch (error) {
      console.error('Failed to add source:', error)
      toast.error('Ошибка при добавлении')
    } finally {
      setAddingSource(false)
    }
  }
  
  async function handleRemoveSource(sourceId) {
    const newSettings = {
      ...syncSettings,
      sources: syncSettings.sources.filter(s => s.id !== sourceId)
    }
    await saveSyncSettings(newSettings)
    toast.success('Источник удалён')
  }
  
  async function handleToggleAutoSync(checked) {
    const newSettings = {
      ...syncSettings,
      auto_sync: checked
    }
    await saveSyncSettings(newSettings)
  }
  
  async function handleSyncSource(source) {
    setSyncingSourceId(source.id)
    
    try {
      const res = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          listingId,
          sources: [source]
        })
      })
      const data = await res.json()
      
      if (data.success) {
        // Update source with new sync info
        const newSettings = {
          ...syncSettings,
          sources: syncSettings.sources.map(s => 
            s.id === source.id 
              ? { ...s, last_sync: new Date().toISOString(), status: 'active', events_count: data.eventsProcessed || 0 }
              : s
          ),
          last_sync: new Date().toISOString()
        }
        await saveSyncSettings(newSettings)
        loadBlockedDates()
        toast.success(`Синхронизировано: ${data.eventsProcessed || 0} событий`)
        if (onSync) onSync()
      } else {
        toast.error(data.error || 'Ошибка синхронизации')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Ошибка синхронизации')
    } finally {
      setSyncingSourceId(null)
    }
  }
  
  async function handleSyncAll() {
    if (syncSettings.sources.length === 0) {
      toast.error('Нет источников для синхронизации')
      return
    }
    
    setSyncing(true)
    
    try {
      const res = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'sync', 
          listingId,
          sources: syncSettings.sources.filter(s => s.enabled)
        })
      })
      const data = await res.json()
      
      if (data.success) {
        const newSettings = {
          ...syncSettings,
          last_sync: new Date().toISOString()
        }
        await saveSyncSettings(newSettings)
        loadBlockedDates()
        toast.success(`Синхронизировано: ${data.eventsProcessed || 0} событий`)
        if (onSync) onSync()
      } else {
        toast.error(data.error || 'Ошибка синхронизации')
      }
    } catch (error) {
      console.error('Sync all error:', error)
      toast.error('Ошибка синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader className="pb-2 lg:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base lg:text-lg">iCal Синхронизация</CardTitle>
              <CardDescription className="text-xs">
                Импорт календарей с Airbnb, Booking и др.
              </CardDescription>
            </div>
          </div>
          
          {/* Sync All Button */}
          {syncSettings.sources.length > 0 && (
            <Button
              onClick={handleSyncAll}
              disabled={syncing}
              variant="outline"
              size="sm"
              className="border-indigo-300 text-indigo-600 hover:bg-indigo-100"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Синхронизировать все
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Add New Source Form */}
        <div className="bg-white rounded-xl p-4 border border-indigo-200 space-y-3">
          <Label className="text-sm font-medium text-slate-700">Добавить календарь</Label>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Input
                placeholder="https://www.airbnb.com/calendar/ical/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full"
              />
            </div>
            
            <Select value={newPlatform} onValueChange={setNewPlatform}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Платформа" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              onClick={handleAddSource}
              disabled={addingSource || !newUrl.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
            >
              {addingSource ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить
                </>
              )}
            </Button>
          </div>
          
          <p className="text-xs text-slate-500">
            Найдите ссылку iCal в настройках календаря вашей платформы
          </p>
        </div>
        
        {/* Sources List */}
        {syncSettings.sources.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700">
                Подключённые календари ({syncSettings.sources.length})
              </Label>
              
              {/* Auto Sync Toggle */}
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-sync" className="text-xs text-slate-600">
                  Авто-синхронизация
                </Label>
                <Switch
                  id="auto-sync"
                  checked={syncSettings.auto_sync}
                  onCheckedChange={handleToggleAutoSync}
                  disabled={saving}
                />
              </div>
            </div>
            
            {syncSettings.sources.map((source) => (
              <div
                key={source.id}
                className="bg-white rounded-lg p-3 border border-slate-200 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getPlatformBadge(source.platform)}
                    {source.status === 'active' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {source.status === 'error' && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate" title={source.url}>
                    {source.url}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {source.last_sync && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(source.last_sync).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                    {source.events_count > 0 && (
                      <span className="text-xs text-slate-400">
                        {source.events_count} событий
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSyncSource(source)}
                    disabled={syncingSourceId === source.id}
                    className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
                  >
                    {syncingSourceId === source.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveSource(source.id)}
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/60 rounded-lg p-6 text-center">
            <Link2 className="h-10 w-10 mx-auto mb-2 text-indigo-300" />
            <p className="text-sm text-slate-600">Нет подключённых календарей</p>
            <p className="text-xs text-slate-500 mt-1">
              Добавьте iCal ссылку для автоматической блокировки дат
            </p>
          </div>
        )}
        
        {/* Blocked Dates Summary */}
        {blockedDates.length > 0 && (
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Заблокировано дат: {blockedDates.length}
              </span>
            </div>
            <div className="space-y-1">
              {blockedDates.slice(0, 3).map((block) => (
                <p key={block.id} className="text-xs text-amber-700">
                  {new Date(block.check_in).toLocaleDateString('ru-RU')} — {new Date(block.check_out).toLocaleDateString('ru-RU')}
                  {block.guest_name && ` (${block.guest_name})`}
                </p>
              ))}
              {blockedDates.length > 3 && (
                <p className="text-xs text-amber-600">
                  ... и ещё {blockedDates.length - 3}
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Last Sync Info */}
        {syncSettings.last_sync && (
          <p className="text-xs text-slate-500 text-center">
            Последняя синхронизация: {new Date(syncSettings.last_sync).toLocaleString('ru-RU')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
