'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Gift, Copy, Loader2, Users, Wallet, Share2, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';

function formatThb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

export default function ReferralProfilePage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [walletData, setWalletData] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/profile?login=true');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [refRes, walletRes] = await Promise.all([
          fetch('/api/v2/referral/me', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/v2/wallet/me', { credentials: 'include', cache: 'no-store' }),
        ]);
        const json = await refRes.json().catch(() => ({}));
        const wJson = await walletRes.json().catch(() => ({}));
        if (!cancelled) {
          if (refRes.ok && json?.success) {
            setData(json.data || null);
          } else {
            toast.error(json?.error || 'Не удалось загрузить реферальные данные');
          }
          if (walletRes.ok && wJson?.success && wJson?.data) {
            setWalletData(wJson.data);
          }
        }
      } catch {
        if (!cancelled) toast.error('Ошибка загрузки реферальной страницы');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, router]);

  const welcomeExpiryHint = (() => {
    const w = walletData?.wallet;
    const rem = Number(w?.welcome_bonus_remaining_thb ?? 0);
    const expIso = w?.welcome_bonus_expires_at;
    if (!(rem > 0) || !expIso) return null;
    const exp = new Date(expIso);
    const now = new Date();
    if (Number.isNaN(exp.getTime()) || exp <= now) return null;
    const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
    return { rem, days, expIso };
  })();
  const payoutProgress = (() => {
    const balances = walletData?.balances;
    if (!balances) return null;
    const withdrawable = Number(
      balances.withdrawableBalanceThb ?? walletData?.wallet?.withdrawable_balance_thb ?? 0,
    );
    const internal = Number(
      balances.internalCreditsThb ?? walletData?.wallet?.internal_credits_thb ?? 0,
    );
    const total = Math.max(0, withdrawable + internal);
    return {
      withdrawable: Math.max(0, withdrawable),
      internal: Math.max(0, internal),
      total,
      withdrawablePct: total > 0 ? Math.round((Math.max(0, withdrawable) / total) * 100) : 0,
    };
  })();

  async function handleCopyLink() {
    const link = String(data?.referralLink || '').trim();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Реферальная ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  }

  function handleShareTelegram() {
    const text = encodeURIComponent(String(data?.shareMessage || data?.referralLink || ''));
    if (!text) return;
    window.open(`https://t.me/share/url?url=&text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(String(data?.shareMessage || data?.referralLink || ''));
    if (!text) return;
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="py-10 flex items-center justify-center text-slate-600">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Загрузка реферальной программы...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-4">
      {data?.inviteNetwork ? (
        <Card className="border border-slate-200 bg-slate-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Сеть приглашений</CardTitle>
            <CardDescription className="text-xs">
              Глубина цепочки от корневого промоутера (Stage 72.2). Не зависит от роли «рентер / партнёр».
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-800 space-y-1">
            <p>
              Ваша глубина:{' '}
              <span className="font-semibold tabular-nums">{Number(data.inviteNetwork.depth || 1)}</span>
            </p>
            <p className="text-xs text-slate-600">
              Звеньев до корня (ancestor chain):{' '}
              <span className="font-mono tabular-nums">{Number(data.inviteNetwork.ancestorChainLength || 0)}</span>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-dashed border-slate-200 bg-white">
          <CardContent className="py-4 text-sm text-slate-600">
            Вы зарегистрировались без реферального кода — вы в корне своей ветки как пригласитель.
          </CardContent>
        </Card>
      )}

      {walletData?.payout ? (
        <Card
          className={
            walletData.payout.payoutEligible
              ? 'border border-emerald-200 bg-emerald-50/70'
              : 'border border-slate-200 bg-white'
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-700" />
              Вывод бонусного баланса
            </CardTitle>
            <CardDescription className="text-xs">
              Минимум {formatThb(walletData.payout.minPayoutThb)} THB, подтверждённый email и допуск к выплатам.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className={walletData.payout.payoutEligible ? 'text-emerald-900 font-medium' : 'text-slate-700'}>
              {walletData.payout.payoutEligible
                ? 'Условия для запроса вывода выполнены (после запуска продукта «вывод на карту»).'
                : `Пока недоступно: ${(walletData.payout.blockers || []).join(', ') || 'см. настройки профиля'}.`}
            </p>
            {!walletData.payout.profileVerified ? (
              <p className="text-xs text-amber-800">Подтвердите email в профиле.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {payoutProgress ? (
        <Card className="border border-indigo-200 bg-indigo-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Retention split бонусов</CardTitle>
            <CardDescription className="text-xs">
              Доступно к выводу: {formatThb(payoutProgress.withdrawable)} THB. На будущие поездки:{' '}
              {formatThb(payoutProgress.internal)} THB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={payoutProgress.withdrawablePct} className="h-2" />
            <p className="text-xs text-slate-600">
              Withdrawable {payoutProgress.withdrawablePct}% / Internal {Math.max(0, 100 - payoutProgress.withdrawablePct)}%
            </p>
          </CardContent>
        </Card>
      ) : null}

      {payoutProgress && payoutProgress.internal > 0 ? (
        <Card className="border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Маркетинговый push</CardTitle>
            <CardDescription className="text-xs text-amber-900">
              У вас накопилось {formatThb(payoutProgress.internal)} THB внутренних бонусов. Вы можете потратить их на
              оплату сервисного сбора или Priority Listing для ваших объектов.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push('/profile/bookings')}>
              Потратить на сервисный сбор
            </Button>
            <Button onClick={() => router.push('/partner/listings?upsell=priority')}>
              Включить Priority Listing
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-teal-600" />
            Приглашайте друзей
          </CardTitle>
          <CardDescription>Делитесь ссылкой и получайте бонусы после завершенных бронирований.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Ваш персональный код</p>
            <Input value={data?.code || 'AIR-XXXXXX'} readOnly className="font-semibold tracking-wide" />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Ваша ссылка</p>
            <div className="flex gap-2">
              <Input value={data?.referralLink || ''} readOnly />
              <Button type="button" onClick={handleCopyLink} className="bg-teal-600 hover:bg-teal-700">
                <Copy className="h-4 w-4 mr-1" />
                Скопировать
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleShareTelegram}>
              <MessageCircle className="h-4 w-4 mr-1" />
              Поделиться в Telegram
            </Button>
            <Button type="button" variant="outline" onClick={handleShareWhatsApp}>
              <Share2 className="h-4 w-4 mr-1" />
              Поделиться в WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>

      {data?.turbo?.enabled === true && Number(data?.turbo?.promoBoostPerBookingThb || 0) > 0 ? (
        <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-amber-900">Turbo Mode активен</CardTitle>
            <CardDescription className="text-amber-800">
              Акция: +{formatThb(data?.turbo?.promoBoostPerBookingThb)} THB к каждому приглашению!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-slate-700">Ваш буст на долю реферера за booking:</p>
            <p className="text-xl font-bold text-amber-700">
              <span className="line-through text-slate-400 mr-2">
                +฿{formatThb(data?.turbo?.oldReferrerBonusWithBoostThb)}
              </span>
              +฿{formatThb(data?.turbo?.newReferrerBonusWithBoostThb)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Твой путь по уровням Амбассадора</CardTitle>
          <CardDescription>
            {data?.ambassador?.remainingToNextTier > 0 && data?.ambassador?.nextTier?.name
              ? `До следующего уровня (${data.ambassador.nextTier.name}) осталось пригласить ${Number(
                  data.ambassador.remainingToNextTier,
                ).toLocaleString('ru-RU')} партнеров.`
              : 'Вы на максимальном уровне. Поддерживайте эффективность ветки и качество партнеров.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={Number(data?.ambassador?.tierProgressPercent || 0)} className="h-2" />
          <div className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
            <span>
              Уровень: <strong>{data?.ambassador?.currentTier?.name || 'Beginner'}</strong>
            </span>
            <span>·</span>
            <span>
              Партнеров приглашено: {Number(data?.ambassador?.directPartnersInvited || 0).toLocaleString('ru-RU')}
            </span>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-xs underline underline-offset-2 text-indigo-700"
                    aria-label="Как работает вывод по уровню"
                  >
                    Как работает вывод
                  </button>
                </TooltipTrigger>
                <TooltipContent>{data?.ambassador?.payoutTooltip || 'Tier payout tooltip'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-slate-500">Ожидает</p>
            <p className="text-xl font-semibold text-amber-700 flex items-center gap-2">
              <Wallet className="h-4 w-4" /> ฿{formatThb(data?.stats?.pendingThb)}
            </p>
            {welcomeExpiryHint ? (
              <p className="text-xs rounded-md bg-amber-50 border border-amber-200 text-amber-950 px-2 py-1.5 leading-snug">
                Около ฿{formatThb(welcomeExpiryHint.rem)} приветственного бонуса сгорит через{' '}
                <span className="font-semibold tabular-nums">{welcomeExpiryHint.days}</span>{' '}
                {welcomeExpiryHint.days === 1 ? 'день' : welcomeExpiryHint.days < 5 ? 'дня' : 'дней'}.
              </p>
            ) : walletData?.wallet?.balance_thb != null ? (
              <p className="text-xs text-slate-500">
                Баланс бонусного кошелька: ฿{formatThb(walletData.wallet.balance_thb)} (internal:{' '}
                ฿{formatThb(walletData?.wallet?.internal_credits_thb || 0)}, withdrawable:{' '}
                ฿{formatThb(walletData?.wallet?.withdrawable_balance_thb || 0)})
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Заработано</p>
            <p className="text-xl font-semibold text-emerald-700 flex items-center gap-2">
              <Wallet className="h-4 w-4" /> ฿{formatThb(data?.stats?.earnedThb)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Друзей приглашено</p>
            <p className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {Number(data?.stats?.friendsInvited || 0).toLocaleString('ru-RU')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

