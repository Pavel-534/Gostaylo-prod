'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Link2, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, 
  AlertCircle, ExternalLink, Calendar, HelpCircle, Clock
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'

const ICAL_SOURCES = [
  { value: 'Airbnb', label: 'Airbnb', color: 'bg-red-100 text-red-700' },
  { value: 'Booking.com', label: 'Booking.com', color: 'bg-blue-100 text-blue-700' },
  { value: 'VRBO', label: 'VRBO', color: 'bg-purple-100 text-purple-700' },
  { value: 'Google Calendar', label: 'Google Calendar', color: 'bg-green-100 text-green-700' },
  { value: 'Other', label: 'Other', color: 'bg-slate-100 text-slate-700' }
]

function detectSource(url) {
  if (!url) return 'Other'
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('airbnb')) return 'Airbnb'
  if (lowerUrl.includes('booking.com')) return 'Booking.com'
  if (lowerUrl.includes('vrbo') || lowerUrl.includes('homeaway')) return 'VRBO'
  if (lowerUrl.includes('google.com')) return 'Google Calendar'
  return 'Other'
}

function getSourceBadge(source) {
  const config = ICAL_SOURCES.find(s => s.value === source) || ICAL_SOURCES[4]
  return <Badge className={config.color}>{config.label}</Badge>
}

export default function CalendarSyncManager({ listingId, onSync }) {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncingSourceId, setSyncingSourceId] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [blockedDates, setBlockedDates] = useState([])
  
  // New source form
  const [newUrl, setNewUrl] = useState('')
  const [newSource, setNewSource] = useState('')
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
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=metadata`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await res.json()
      const listing = data?.[0]
      
      if (listing) {
        // Get sync_settings from metadata
        let syncSettings = listing.metadata?.sync_settings || []
        
        // Add legacy URL if present and not already in sources
        const legacyUrl = listing.metadata?.icalUrl
        if (legacyUrl && !syncSettings.find(s => s.url === legacyUrl)) {
          syncSettings.push({
            id: 'legacy',
            url: legacyUrl,
            source: detectSource(legacyUrl),
            enabled: true,
            last_sync: listing.metadata?.last_ical_sync,
            status: 'unknown'
          })
        }
        
        setSources(syncSettings)
        setLastSync(listing.metadata?.last_ical_sync)
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load sync settings:', error)
      setLoading(false)
    }
  }
  
  async function loadBlockedDates() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/bookings?listing_id=eq.${listingId}&status=eq.BLOCKED_BY_ICAL&select=id,check_in,check_out,metadata,guest_name`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await res.json()
      setBlockedDates(data || [])
    } catch (error) {
      console.error('Failed to load blocked dates:', error)
    }
  }
  
  async function saveSyncSettings(newSources) {
    try {
      // First get current metadata
      const getRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=metadata`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      )
      const getData = await getRes.json()
      const currentMetadata = getData?.[0]?.metadata || {}
      
      // Update with new sync_settings
      await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          metadata: { 
            ...currentMetadata, 
            sync_settings: newSources 
          } 
        })
      })
    } catch (error) {
      console.error('Failed to save sync settings:', error)
    }
  }
  
  async function handleAddSource() {
    if (!newUrl) {
      toast.error('Введите URL календаря')
      return
    }
    
    // Validate URL
    if (!newUrl.startsWith('http')) {
      toast.error('URL должен начинаться с http:// или https://')
      return
    }
    
    setAddingSource(true)
    
    try {
      // Test the URL first - use relative path for client-side
      const testRes = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse', url: newUrl })
      })
      const testData = await testRes.json()
      
      if (!testData.success) {
        toast.error(`Ошибка: ${testData.error}`)
        setAddingSource(false)
        return
      }
      
      const detectedSource = newSource || testData.source || detectSource(newUrl)
      
      const newSourceConfig = {
        id: `src-${Date.now().toString(36)}`,
        url: newUrl,
        source: detectedSource,
        enabled: true,
        added_at: new Date().toISOString(),
        status: 'pending'
      }
      
      const updatedSources = [...sources, newSourceConfig]
      setSources(updatedSources)
      await saveSyncSettings(updatedSources)
      
      toast.success(`✅ Добавлен ${detectedSource} (${testData.futureEvents} событий)`)
      
      setNewUrl('')
      setNewSource('')
      
      // Trigger sync
      handleSyncSource(newSourceConfig)
      
    } catch (error) {
      toast.error('Ошибка проверки URL')
    }
    
    setAddingSource(false)
  }
  
  async function handleRemoveSource(sourceId) {
    const updatedSources = sources.filter(s => s.id !== sourceId)
    setSources(updatedSources)
    await saveSyncSettings(updatedSources)
    
    // Remove blocked dates from this source
    const sourceBlocks = blockedDates.filter(b => b.metadata?.ical_source_id === sourceId)
    for (const block of sourceBlocks) {
      await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${block.id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      })
    }
    
    toast.success('Источник удалён')
    loadBlockedDates()
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
        const result = data.results?.[0]
        toast.success(`✅ Синхронизировано: +${result?.eventsCreated || 0} / -${result?.eventsRemoved || 0}`)
        
        // Update source status
        const updatedSources = sources.map(s => 
          s.id === source.id 
            ? { ...s, last_sync: new Date().toISOString(), status: 'success' }
            : s
        )
        setSources(updatedSources)
        await saveSyncSettings(updatedSources)
        
        loadBlockedDates()
        if (onSync) onSync()
      } else {
        toast.error(`Ошибка: ${data.error}`)
        
        const updatedSources = sources.map(s => 
          s.id === source.id ? { ...s, status: 'error', error: data.error } : s
        )
        setSources(updatedSources)
      }
    } catch (error) {
      toast.error('Ошибка синхронизации')
    }
    
    setSyncingSourceId(null)
  }
  
  async function handleSyncAll() {
    setSyncing(true)
    
    try {
      const res = await fetch('http://localhost:3000/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', listingId })
      })
      const data = await res.json()
      
      if (data.success) {
        const totalCreated = data.results?.reduce((sum, r) => sum + (r.eventsCreated || 0), 0) || 0
        const totalRemoved = data.results?.reduce((sum, r) => sum + (r.eventsRemoved || 0), 0) || 0
        
        toast.success(`✅ Все источники синхронизированы: +${totalCreated} / -${totalRemoved}`)
        
        setLastSync(new Date().toISOString())
        loadSyncSettings()
        loadBlockedDates()
        if (onSync) onSync()
      } else {
        toast.error(`Ошибка: ${data.error}`)
      }
    } catch (error) {
      toast.error('Ошибка синхронизации')
    }
    
    setSyncing(false)
  }
  
  function formatDate(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }
  
  function formatDateTime(dateStr) {
    if (!dateStr) return 'Никогда'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  if (loading) {
    return (
      <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
        <CardContent className="p-8 flex justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-orange-500" />
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
              <Link2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Синхронизация календаря</CardTitle>
              <CardDescription>
                Импорт занятых дат из внешних платформ
              </CardDescription>
            </div>
          </div>
          
          {sources.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAll}
              disabled={syncing}
              className="border-orange-300 hover:bg-orange-100"
            >
              {syncing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Синхронизировать всё
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Add New Source */}
        <div className="bg-white/80 rounded-lg p-4 border border-orange-200">
          <Label className="text-sm font-medium mb-3 block">Добавить источник</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="url"
                placeholder="https://www.airbnb.com/calendar/ical/..."
                value={newUrl}
                onChange={(e) => {
                  setNewUrl(e.target.value)
                  if (e.target.value) {
                    setNewSource(detectSource(e.target.value))
                  }
                }}
                className="bg-white"
                data-testid="ical-url-input"
              />
            </div>
            <Select value={newSource} onValueChange={setNewSource}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Платформа" />
              </SelectTrigger>
              <SelectContent>
                {ICAL_SOURCES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAddSource}
              disabled={addingSource || !newUrl}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {addingSource ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="mt-3 text-xs text-slate-600 space-y-1">
            <p className="font-medium">💡 Как найти iCal ссылку:</p>
            <ul className="space-y-0.5 ml-4 text-slate-500">
              <li>• <b>Airbnb:</b> Календарь → Доступность → Экспорт</li>
              <li>• <b>Booking.com:</b> Объект → Цены → Синхронизация календарей</li>
              <li>• <b>VRBO:</b> Календарь → iCal → Экспорт URL</li>
            </ul>
          </div>
        </div>
        
        {/* Sources List */}
        {sources.length > 0 ? (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Подключённые источники ({sources.length})</Label>
            
            {sources.map((source) => (
              <div
                key={source.id}
                className="bg-white rounded-lg p-4 border border-slate-200 flex items-center gap-4"
              >
                <div className="flex-shrink-0">
                  {source.status === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : source.status === 'error' ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getSourceBadge(source.source)}
                    <span className="text-xs text-slate-500 truncate">
                      {source.url?.substring(0, 50)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(source.last_sync)}
                    </span>
                    {source.status === 'error' && (
                      <span className="text-red-500">{source.error}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(source.url, '_blank')}
                    title="Открыть URL"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSyncSource(source)}
                    disabled={syncingSourceId === source.id}
                    title="Синхронизировать"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncingSourceId === source.id ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveSource(source.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-orange-300" />
            <p>Нет подключённых календарей</p>
            <p className="text-sm">Добавьте iCal ссылку для автоматической блокировки дат</p>
          </div>
        )}
        
        {/* Blocked Dates Summary */}
        {blockedDates.length > 0 && (
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <Label className="text-sm font-medium text-red-800 mb-3 block">
              Заблокированные даты ({blockedDates.length})
            </Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {blockedDates.slice(0, 10).map((block) => (
                <div key={block.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-slate-700">
                      {formatDate(block.check_in)} — {formatDate(block.check_out)}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {block.metadata?.ical_source || 'iCal'}
                  </Badge>
                </div>
              ))}
              {blockedDates.length > 10 && (
                <p className="text-xs text-slate-500 text-center pt-2">
                  ... и ещё {blockedDates.length - 10} дат
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Last Sync Info */}
        {lastSync && (
          <div className="text-xs text-slate-500 text-center">
            Последняя синхронизация: {formatDateTime(lastSync)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
