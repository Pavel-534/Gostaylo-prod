#!/usr/bin/env node
/**
 * Stage 72.4 — симуляция маржи, retention и promo pot (без БД).
 * Запуск: node scripts/simulate-stage72-4-marketing-cashflow.mjs
 *
 * Зеркалит логику:
 * - ReferralPnlService.deriveNetProfitAfterVariableCosts (от platform gross)
 * - referralPoolRaw = netProfit * referral_reinvestment_percent / 100, cap SAFETY_LOCK_MAX_SHARE * gross
 * - split referral_split_ratio на referrer/referee (guest_booking)
 * - WalletService.addFunds: referral_bonus → payout_to_internal_ratio на withdrawable; cashback → 100% internal
 * - distributeHostPartnerActivation: фикс бонус из promo pot, MLM L1/L2 по ancestor_path
 * - Organic: applyOrganicTopup = netProfit * organic_to_promo_pot_percent / 100
 */

const SAFETY_LOCK_MAX_SHARE = 0.95;

function round2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function clamp(x, a, b) {
  return Math.min(b, Math.max(a, x));
}

// --- Вводные пользователя (пластичные) ---
const HOST_PRICE_THB = 10000;
const GUEST_PRICE_THB = 11000;
const PLATFORM_GROSS_PER_BOOKING = round2(GUEST_PRICE_THB - HOST_PRICE_THB); // 1000 "комиссия системы"

const INSURANCE_SHARE_OF_GROSS = 0.05; // 5% от комиссии → резерв (в коде insurance_reserve из snapshot)
const OPS_SHARE_OF_GROSS = 0.3; // 30% эквайринг+налоги+хостинг (в коде acquiring+operational % от platform gross)

const referralReinvestmentPercent = 100; // чтобы весь netProfit (65% от комиссии) ушёл в реф. пул при заданных долях
const referralSplitRatio = 0.5; // L1 referrer / cashback referee — как DEFAULT_REFERRAL_SPLIT_RATIO
const payoutToInternalRatio = 70; // имя в БД вводит в заблуждение: доля К ВЫВОДУ (см. wallet.service + PAYOUT_RETENTION_LOGIC)

const partnerActivationBonusThb = 500;
const mlmL1Percent = 70;
const mlmL2Percent = 30;

/** Доля netProfit, уходящая в marketing_promo_pot при органике (system_settings.general.organic_to_promo_pot_percent). В коде по умолчанию 0 — укажите явно. */
const organicToPromoPotPercent = 15;

/** Стартовый баланс marketing_promo_pot до сделок (если 0 — host_activation НЕ исполнится). */
const initialPromoPotThb = 500;

// Порядок: первая завершённая бронь у C как хоста → host activation на ней.
// Сценарий: сначала D (реферал), затем E (органика).
void (async function main() {
  const acquiringPercent = OPS_SHARE_OF_GROSS * 0.5 * 100; // 15%
  const operationalPercent = OPS_SHARE_OF_GROSS * 0.5 * 100; // 15% — разбивка условная; сумма даёт 30% от gross

  const insuranceThb = round2(PLATFORM_GROSS_PER_BOOKING * INSURANCE_SHARE_OF_GROSS);
  const acquiringThb = round2(PLATFORM_GROSS_PER_BOOKING * (acquiringPercent / 100));
  const operationalThb = round2(PLATFORM_GROSS_PER_BOOKING * (operationalPercent / 100));
  const netProfitOrderThb = round2(
    Math.max(0, PLATFORM_GROSS_PER_BOOKING - insuranceThb - acquiringThb - operationalThb),
  );

  const refPoolRaw = round2(netProfitOrderThb * (referralReinvestmentPercent / 100));
  const safetyCap = round2(PLATFORM_GROSS_PER_BOOKING * SAFETY_LOCK_MAX_SHARE);
  const referralPoolThb = round2(Math.min(refPoolRaw, safetyCap));

  console.log('=== Stage 72.4 — симуляция cashflow / retention (node) ===\n');
  console.log(`Комиссия (разница гость–хозяин): ${PLATFORM_GROSS_PER_BOOKING} THB / бронь`);
  console.log(`Разложение gross: страховой резерв ${insuranceThb} (${(INSURANCE_SHARE_OF_GROSS * 100).toFixed(0)}%), acquiring ${acquiringThb} (${acquiringPercent}%), op ${operationalThb} (${operationalPercent}%)`);
  console.log(`NetProfitOrder (база реф. пула): ${netProfitOrderThb} THB (${((netProfitOrderThb / PLATFORM_GROSS_PER_BOOKING) * 100).toFixed(1)}% от комиссии)`);
  console.log(`Referral pool (reinvest=${referralReinvestmentPercent}%): ${referralPoolThb} THB | safety cap ${safetyCap} THB\n`);

  function splitRetentionReferralBonus(grossBonus) {
    const g = round2(grossBonus);
    const wd = round2(g * (payoutToInternalRatio / 100));
    const intr = round2(g - wd);
    return { withdrawable: wd, internal: intr };
  }

  // --- Бронь 1: D приглашён C; renter_id=D, referrer C ---
  const cBonusGross = round2(referralPoolThb * referralSplitRatio);
  const dCashbackGross = round2(referralPoolThb - cBonusGross);
  const cRet = splitRetentionReferralBonus(cBonusGross);
  const dCashbackInternal = round2(dCashbackGross); // referral_cashback → 100% internal

  // --- Host activation на первой завершённой брони (D): L1=B, L2=A ---
  const mlmSum = mlmL1Percent + mlmL2Percent;
  const bActGross = round2((partnerActivationBonusThb * mlmL1Percent) / mlmSum);
  const aActGross = round2(partnerActivationBonusThb - bActGross);
  const bRet = splitRetentionReferralBonus(bActGross);
  const aRet = splitRetentionReferralBonus(aActGross);

  let promoPot = round2(initialPromoPotThb);
  promoPot = round2(promoPot - partnerActivationBonusThb);
  const activationNote =
    initialPromoPotThb >= partnerActivationBonusThb
      ? 'OK (достаточно бака)'
      : 'SKIP в проде (adjustMarketingPromoPot не пройдёт)';

  // --- Бронь 2: E органика ---
  const organicTopup = round2(netProfitOrderThb * (organicToPromoPotPercent / 100));
  promoPot = round2(promoPot + organicTopup);
  const platformRetainedOrganicNet = round2(netProfitOrderThb - organicTopup);

  console.log('--- Бронь 1 (реферал D → хост C, гость платит 11 000) ---');
  console.log(`Referrer bonus (C): gross ${cBonusGross} → WD ${cRet.withdrawable} | INT ${cRet.internal}`);
  console.log(`Referee cashback (D): gross ${dCashbackGross} → WD 0 | INT ${dCashbackInternal}`);
  console.log(`Host activation (первая COMPLETED у C): бонус ${partnerActivationBonusThb} из promo pot → B ${bActGross}, A ${aActGross}`);
  console.log(`  B: WD ${bRet.withdrawable} | INT ${bRet.internal}`);
  console.log(`  A: WD ${aRet.withdrawable} | INT ${aRet.internal}`);
  console.log(`Promo pot после активации: ${round2(initialPromoPotThb - partnerActivationBonusThb)} (${activationNote})\n`);

  console.log('--- Бронь 2 (органика E, тот же объект) ---');
  console.log(`Organic topup в pot (${organicToPromoPotPercent}% от NetProfit): ${organicTopup} THB`);
  console.log(`Остаток NetProfit без распределения в пот (экономически у платформы): ${platformRetainedOrganicNet} THB`);
  console.log(`Promo pot финал: ${promoPot} THB\n`);

  const rows = [
    ['User_A', aRet.withdrawable, aRet.internal],
    ['User_B', bRet.withdrawable, bRet.internal],
    ['User_C', cRet.withdrawable, cRet.internal],
    ['User_D', 0, dCashbackInternal],
  ];

  console.log('=== Таблица доходов (THB) ===');
  console.log('| Участник | К выводу (withdrawable) | Внутренние (internal) |');
  console.log('|----------|-------------------------|-------------------------|');
  for (const [u, w, i] of rows) {
    console.log(`| ${u} | ${round2(w)} | ${round2(i)} |`);
  }

  const sumWd = round2(rows.reduce((s, [, w]) => s + w, 0));
  const sumInt = round2(rows.reduce((s, [, , i]) => s + i, 0));
  console.log(`| Σ | ${sumWd} | ${sumInt} |`);

  const reserveFundAccrued = round2(insuranceThb * 2);
  const opExCash = round2((acquiringThb + operationalThb) * 2);
  const commissionInflow = round2(PLATFORM_GROSS_PER_BOOKING * 2);

  console.log('\n=== Балансы и эффективность ===');
  console.log(`Начислено страхового резерва (из gross, 2 брони): ${reserveFundAccrued} THB (в коде — поля snapshot, не отдельный cash-счёт)`);
  console.log(`Операционный блок (2 брони): ${opExCash} THB`);
  console.log(`Вход комиссии (2 брони): ${commissionInflow} THB`);

  const netFiatLike =
    commissionInflow - opExCash - reserveFundAccrued - sumWd;
  console.log(
    `\nУпрощённый «остаток после провизий и обязательств WD» (комиссия − OPEX − резерв − сумма к выводу): ${round2(netFiatLike)} THB`,
  );
  console.log('(Internal credits не вычитаются как немедленный cash-out.)');

  const guestGmv = GUEST_PRICE_THB * 2;
  const systemControlled =
    round2(netFiatLike + sumInt + promoPot + reserveFundAccrued + opExCash);
  console.log(`\nВходящая масса через гостя (2×${GUEST_PRICE_THB}): ${guestGmv} THB`);
  console.log(
    `Доля под контролем платформы (остаток+internal+pot+резерв+op в модели): компоненты смешаны — см. markdown-отчёт.`,
  );

  console.log('\n=== Риск дефицита наличности ===');
  if (initialPromoPotThb < partnerActivationBonusThb) {
    console.log('⚠️  При нулевом/низком promo pot host_activation не исполнится — дефицит обещаний MLM, не только «кассы».');
  } else {
    console.log('✓ При данных начальных условиях активация прошла.');
  }
})();
