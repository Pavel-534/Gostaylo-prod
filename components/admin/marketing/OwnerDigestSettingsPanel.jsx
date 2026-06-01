'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, Send, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function OwnerDigestSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    emailEnabled: true,
    telegramEnabled: true,
    recipientEmails: [],
    lastSentAt: null,
    lastSentWeekKey: null,
  });
  const [emailInput, setEmailInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/marketing/owner-digest', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'LOAD_FAILED');
      setSettings(json.settings || {});
      setEmailInput((json.settings?.recipientEmails || []).join(', '));
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить настройки дайджеста');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const recipientEmails = emailInput
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter((s) => s.includes('@'));
      const res = await fetch('/api/admin/marketing/owner-digest', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          emailEnabled: settings.emailEnabled,
          telegramEnabled: settings.telegramEnabled,
          recipientEmails,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'SAVE_FAILED');
      setSettings(json.settings);
      toast.success('Настройки дайджеста сохранены');
    } catch (e) {
      toast.error(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/admin/marketing/owner-digest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_test' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'SEND_FAILED');
      const r = json.result || {};
      if (r.skipped) {
        toast.message(`Пропущено: ${r.reason}`);
      } else {
        toast.success(
          `Отправлено: email ${r.email?.sent ?? 0}, Telegram ${r.telegram?.success ? 'да' : 'нет'}`,
        );
      }
      load();
    } catch (e) {
      toast.error(e?.message || 'Не удалось отправить тест');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <Card className="border-slate-200/80 animate-pulse h-48" />;
  }

  return (
    <Card className="border-violet-200/80 shadow-sm" id="owner-digest">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-violet-600" />
          Owner Digest (еженедельно)
        </CardTitle>
        <CardDescription>
          Email и Telegram с ROI, CAC, топ/анти-топ кампаний и алертами. По понедельникам 07:00 UTC (cron).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(settings.enabled)}
            onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
            className="rounded border-slate-300"
          />
          Включить еженедельную рассылку
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={settings.emailEnabled !== false}
            onChange={(e) => setSettings((s) => ({ ...s, emailEnabled: e.target.checked }))}
            className="rounded border-slate-300"
          />
          <Mail className="h-3.5 w-3.5 text-slate-500" />
          Email
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={settings.telegramEnabled !== false}
            onChange={(e) => setSettings((s) => ({ ...s, telegramEnabled: e.target.checked }))}
            className="rounded border-slate-300"
          />
          Telegram (топик FINANCE)
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="digest-emails" className="text-xs">
            Email получателей (через запятую)
          </Label>
          <Input
            id="digest-emails"
            placeholder="owner@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />
          <p className="text-[10px] text-slate-500">
            Если пусто — используется env OWNER_DIGEST_EMAIL. Нужен RESEND_API_KEY для реальной отправки.
          </p>
        </div>
        {settings.lastSentAt ? (
          <p className="text-xs text-slate-500">
            Последняя отправка: {new Date(settings.lastSentAt).toLocaleString('ru-RU')}
            {settings.lastSentWeekKey ? ` · ${settings.lastSentWeekKey}` : ''}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={save} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
          <Button type="button" size="sm" onClick={sendTest} disabled={sending}>
            <Send className="h-4 w-4 mr-1" />
            {sending ? 'Отправка…' : 'Тестовая отправка'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default OwnerDigestSettingsPanel;
