/* =====================================================
   BiNiBit Calculator — логика расчёта по Whitepaper v1.0
   Источники: разделы 5.2, 5.3, 5.4, 9.3, 9.4
   ===================================================== */

(function () {
    'use strict';

    // ====== КОНСТАНТЫ ИЗ WHITEPAPER v1.0 ======
    const TIERS = {
        30:  { lockDays: 30,  bonus: 0.55, spot: 0.45, min: 1250,  multiplier: 0.75, exitPenalty: 0.10 },
        90:  { lockDays: 90,  bonus: 0.35, spot: 0.65, min: 7500,  multiplier: 1.00, exitPenalty: 0.15 },
        180: { lockDays: 180, bonus: 0.25, spot: 0.75, min: 25000, multiplier: 1.25, exitPenalty: 0.20 },
        360: { lockDays: 360, bonus: 0.15, spot: 0.85, min: 75000, multiplier: 1.50, exitPenalty: 0.25 }
    };

    // Эмиссия стейкинга по годам (BINI/мес), Whitepaper 5.2
    const EMISSION_BY_YEAR = {
        1: 7_000_000,
        2: 6_000_000,
        3: 4_000_000,
        4: 3_000_000
    };

    // Реферальные уровни L1-L5, Whitepaper 9.3
    const REFERRAL_LEVELS = [
        { level: 1, rate: 0.25, label: 'Прямой реферал' },
        { level: 2, rate: 0.15, label: 'Реферал реферала' },
        { level: 3, rate: 0.12, label: '3-я степень' },
        { level: 4, rate: 0.10, label: '4-я степень' },
        { level: 5, rate: 0.08, label: '5-я степень' }
    ];

    // Бонус статуса франшизы (Whitepaper 9.4)
    const FRANCHISE_BONUS = [0.00, 0.01, 0.02, 0.03, 0.05]; // последний — Franchise Partner (custom, ~5%)

    // Коэффициент ветвления: каждый L1 приводит в среднем N рефералов на следующий уровень
    // Это типичная воронка — не выдумка, а реалистичное предположение
    const BRANCHING_FACTOR = 1.5;

    // ====== DOM ======
    const el = (id) => document.getElementById(id);
    const stakeAmount = el('stake-amount');
    const stakeHint = el('stake-hint');
    const tierBtns = document.querySelectorAll('.tier-btn');
    const totalStaked = el('total-staked');
    const totalStakedVal = el('total-staked-val');
    const totalStakedScenario = el('total-staked-scenario');
    const biniPrice = el('bini-price');
    const referralCount = el('referral-count');
    const referralStake = el('referral-stake');
    const franchiseStatus = el('franchise-status');

    const periodLabel = el('period-label');
    const resultTabs = document.querySelectorAll('.result-tab');
    const resultPanels = document.querySelectorAll('.result-panel');

    // Metric outputs
    const out = {
        apyEffective: el('apy-effective'),
        apyBase: el('apy-base'),
        stakingPeriod: el('staking-period'),
        stakingPeriodUsd: el('staking-period-usd'),
        stakingDaily: el('staking-daily'),
        stakingDailyUsd: el('staking-daily-usd'),
        splitBonus: el('split-bonus'),
        splitSpot: el('split-spot'),
        refTotal: el('ref-total'),
        refTotalUsd: el('ref-total-usd'),
        refLevels: el('ref-levels'),
        grandTotal: el('grand-total'),
        grandTotalUsd: el('grand-total-usd'),
        brStaking: el('br-staking'),
        brReferral: el('br-referral'),
        brRoi: el('br-roi')
    };

    let currentTier = 180;

    // ====== ФУНКЦИИ ======
    function formatBini(n) {
        if (!isFinite(n) || n < 0) return '—';
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
        return n.toFixed(1);
    }

    function formatNumber(n, decimals = 0) {
        if (!isFinite(n)) return '—';
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(n);
    }

    function formatUsd(n) {
        if (!isFinite(n) || n < 0) return '—';
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(n);
    }

    function formatApy(n) {
        if (!isFinite(n)) return '—';
        return n.toFixed(0) + '%';
    }

    // Базовый APY по Whitepaper 5.2: APY = E_staking × 365 / Total Staked
    // E_staking (год 1) = 7M BINI/мес × 12 мес / 365 дней
    // То есть годовая эмиссия стейкинга: 7M × 12 = 84M BINI
    function calcBaseApy(totalStakedMillions, year = 1) {
        const emissionPerYear = EMISSION_BY_YEAR[year] * 12; // годовая эмиссия
        const totalStaked = totalStakedMillions * 1_000_000;
        if (totalStaked <= 0) return 0;
        return (emissionPerYear / totalStaked) * 100;
    }

    function getScenario(staked) {
        if (staked <= 15) return 'Ранний bootstrap';
        if (staked <= 30) return 'Ранний рост';
        if (staked <= 75) return 'Умеренное вовлечение';
        if (staked <= 150) return 'Высокое вовлечение';
        return 'Очень высокое вовлечение';
    }

    // Эффективный APY с учётом множителя тира
    function calcEffectiveApy(baseApy, tier) {
        return baseApy * TIERS[tier].multiplier;
    }

    // Дневной доход: R_daily(u) = S_u × (APY_effective × m_tier) / 365
    // Здесь уже APY_effective = base × multiplier, поэтому:
    function calcDailyReward(stake, effectiveApy) {
        return stake * (effectiveApy / 100) / 365;
    }

    // Реферальные уровни: считаем, что на каждом следующем уровне
    // количество людей = предыдущее × BRANCHING_FACTOR (округление вниз)
    function calcReferralTree(directCount) {
        const tree = [];
        let count = directCount;
        for (const lvl of REFERRAL_LEVELS) {
            tree.push({ ...lvl, count: count });
            count = Math.floor(count * BRANCHING_FACTOR);
        }
        return tree;
    }

    // Доход с каждого уровня рефералов:
    // commission = sum(по каждому рефералу уровня) × referral_daily_reward × rate
    // Здесь упрощённо: считаем, что каждый реферал стейкает referralStake на тире 90 дней
    // (типичный выбор среднего пользователя) — это разумное допущение
    function calcReferralIncome(tree, referralStakeAmount, baseApy, franchiseIdx, days) {
        const fb = FRANCHISE_BONUS[franchiseIdx] || 0;
        // Допущение: рефералы стейкают на тире 90 дней (множитель 1.0) — самый популярный тир
        const refTier = 90;
        const refEffectiveApy = calcEffectiveApy(baseApy, refTier);
        const refDailyPerUser = calcDailyReward(referralStakeAmount, refEffectiveApy);

        let totalPerDay = 0;
        const breakdown = tree.map(lvl => {
            const rate = lvl.rate + fb;
            const perDay = lvl.count * refDailyPerUser * rate;
            totalPerDay += perDay;
            return { ...lvl, rate, perDay, total: perDay * days };
        });
        return { breakdown, totalPerDay, total: totalPerDay * days };
    }

    // ====== ОТРИСОВКА ======
    function render() {
        const stake = parseFloat(stakeAmount.value) || 0;
        const tier = TIERS[currentTier];
        const totalStakedM = parseFloat(totalStaked.value) || 50;
        const price = parseFloat(biniPrice.value) || 0;
        const refCount = parseInt(referralCount.value) || 0;
        const refStake = parseFloat(referralStake.value) || 0;
        const franchiseIdx = parseInt(franchiseStatus.value) || 0;

        // Валидация минималки тира
        if (stake < tier.min) {
            stakeHint.textContent = `⚠ Минимум для тира ${currentTier} дней — ${formatNumber(tier.min)} BINI`;
            stakeHint.className = 'field__hint field__hint--err';
        } else {
            stakeHint.textContent = `✓ Допустимо для тира ${currentTier} дней`;
            stakeHint.className = 'field__hint field__hint--ok';
        }

        // Сценарий
        totalStakedVal.textContent = totalStakedM;
        totalStakedScenario.textContent = getScenario(totalStakedM);

        // Период
        periodLabel.textContent = `за ${tier.lockDays} дней`;

        // === Стейкинг ===
        const baseApy = calcBaseApy(totalStakedM, 1);
        const effectiveApy = calcEffectiveApy(baseApy, currentTier);
        const dailyReward = calcDailyReward(stake, effectiveApy);
        const periodReward = dailyReward * tier.lockDays;
        const bonusPart = periodReward * tier.bonus;
        const spotPart = periodReward * tier.spot;

        out.apyEffective.textContent = formatApy(effectiveApy);
        out.apyBase.textContent = `базовый ${formatApy(baseApy)} × множитель ${tier.multiplier}`;
        out.stakingPeriod.textContent = `${formatNumber(periodReward, 1)} BINI`;
        out.stakingPeriodUsd.textContent = `≈ ${formatUsd(periodReward * price)}`;
        out.stakingDaily.textContent = `${formatNumber(dailyReward, 2)} BINI`;
        out.stakingDailyUsd.textContent = `≈ ${formatUsd(dailyReward * price)}`;
        out.splitBonus.textContent = `${formatNumber(bonusPart, 0)} BINI`;
        out.splitSpot.textContent = `${formatNumber(spotPart, 0)} BINI`;

        // Ширина сплит-бара пропорциональна доле
        document.querySelector('.split-bar__item--bonus').style.width = (tier.bonus * 100) + '%';
        document.querySelector('.split-bar__item--spot').style.width = (tier.spot * 100) + '%';

        // === Рефералы ===
        const tree = calcReferralTree(refCount);
        const refResult = calcReferralIncome(tree, refStake, baseApy, franchiseIdx, tier.lockDays);

        out.refTotal.textContent = `${formatNumber(refResult.total, 1)} BINI`;
        out.refTotalUsd.textContent = `≈ ${formatUsd(refResult.total * price)}`;

        // Список уровней
        out.refLevels.innerHTML = '';
        refResult.breakdown.forEach((lvl, i) => {
            const div = document.createElement('div');
            div.className = `ref-level ref-level--l${lvl.level}`;
            div.innerHTML = `
                <span class="ref-level__label">L${lvl.level}</span>
                <span class="ref-level__rate">${(lvl.rate * 100).toFixed(0)}% · ${lvl.label}</span>
                <span class="ref-level__count">${formatNumber(lvl.count)} чел.</span>
                <span class="ref-level__value">${formatNumber(lvl.total, 1)} BINI</span>
            `;
            out.refLevels.appendChild(div);
        });

        // === Итог ===
        const grandTotal = periodReward + refResult.total;
        const grandUsd = grandTotal * price;
        const roi = stake > 0 ? (grandTotal / stake * 100) : 0;

        out.grandTotal.textContent = `${formatNumber(grandTotal, 1)} BINI`;
        out.grandTotalUsd.textContent = `≈ ${formatUsd(grandUsd)}`;
        out.brStaking.textContent = `${formatNumber(periodReward, 1)} BINI`;
        out.brReferral.textContent = `${formatNumber(refResult.total, 1)} BINI`;
        out.brRoi.textContent = `ROI ${formatNumber(roi, 0)}%`;
    }

    // ====== СОБЫТИЯ ======
    tierBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tierBtns.forEach(b => b.classList.remove('tier-btn--active'));
            btn.classList.add('tier-btn--active');
            currentTier = parseInt(btn.dataset.tier);
            render();
        });
    });

    resultTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            resultTabs.forEach(t => t.classList.remove('result-tab--active'));
            resultPanels.forEach(p => p.classList.remove('result-panel--active'));
            tab.classList.add('result-tab--active');
            el('panel-' + tab.dataset.tab).classList.add('result-panel--active');
        });
    });

    [stakeAmount, totalStaked, biniPrice, referralCount, referralStake, franchiseStatus]
        .forEach(input => {
            const evt = input.type === 'range' || input.tagName === 'SELECT' ? 'input' : 'input';
            input.addEventListener(evt, render);
        });

    // Стартовая отрисовка
    render();
})();
