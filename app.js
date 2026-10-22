/* =====================================================
   BiNiBit Calculator — логика расчёта v4
   Источники: binibit.com/ru/earn/affiliate (октябрь 2026)
              binibit.com/ru/staking (октябрь 2026)
   ===================================================== */

(function () {
    'use strict';

    // ====== КОНСТАНТЫ СТЕЙКИНГА ======
    const STAKING_APY = 120; // %

    const PACKAGES = {
        30:  { lockDays: 30,  bonus: 0.55, spot: 0.45, minUsdt: 10, exitPenalty: 0.10, name: 'Стартовый' },
        90:  { lockDays: 90,  bonus: 0.35, spot: 0.65, minUsdt: 10, exitPenalty: 0.15, name: 'Рост' },
        180: { lockDays: 180, bonus: 0.25, spot: 0.75, minUsdt: 10, exitPenalty: 0.20, name: 'Pro' },
        360: { lockDays: 360, bonus: 0.15, spot: 0.85, minUsdt: 10, exitPenalty: 0.25, name: 'Elit' }
    };

    // ====== РАНГИ ПАРТНЁРСКОЙ ПРОГРАММЫ ======
    const RANKS = [
        { code: 'CADET',        minStakeUsdt: 50,     depth: 1, rates: [0.08] },
        { code: 'CO-PILOT',     minStakeUsdt: 100,    depth: 2, rates: [0.09, 0.07] },
        { code: 'CAPTAIN',      minStakeUsdt: 300,    depth: 3, rates: [0.10, 0.07, 0.03] },
        { code: 'SUPERSONIC',   minStakeUsdt: 1000,   depth: 4, rates: [0.11, 0.07, 0.03, 0.02] },
        { code: 'SQUADRON',     minStakeUsdt: 2500,   depth: 5, rates: [0.11, 0.07, 0.03, 0.02, 0.02] },
        { code: 'MARSHAL',      minStakeUsdt: 5000,   depth: 6, rates: [0.11, 0.07, 0.03, 0.02, 0.02, 0.02] },
        { code: 'STRATOSPHERE', minStakeUsdt: 10000,  depth: 7, rates: [0.11, 0.07, 0.03, 0.02, 0.02, 0.02, 0.015] },
        { code: 'TOPGUN',       minStakeUsdt: 20000,  depth: 8, rates: [0.11, 0.07, 0.03, 0.02, 0.02, 0.02, 0.015, 0.015] }
    ];

    // ====== ЛИДЕРСКИЕ ПУЛЫ ======
    // Каждый пул: доля от прибыли + порог командного объёма в USD
    const LEADER_POOLS = [
        { pool: 1, share: 0.10, minVolumeUsd: 10000 },
        { pool: 2, share: 0.08, minVolumeUsd: 30000 },
        { pool: 3, share: 0.06, minVolumeUsd: 100000 },
        { pool: 4, share: 0.04, minVolumeUsd: 300000 },
        { pool: 5, share: 0.03, minVolumeUsd: 1000000 },
        { pool: 6, share: 0.02, minVolumeUsd: 3000000 },
        { pool: 7, share: 0.02, minVolumeUsd: 10000000 }
    ];

    // Оценка прибыли компании за период (для расчёта пулов)
    // Допущение: 30% от общего объёма стейкинга сети = месячная прибыль компании
    // На деле — переменная величина, поэтому даём оценку
    const ESTIMATED_COMPANY_PROFIT_PER_MONTH_USD = 100000; // 100K USD/мес — оценочно

    // ====== DOM ======
    const el = (id) => document.getElementById(id);
    const stakesContainer = el('stakes-container');
    const btnAddStake = el('btn-add-stake');
    const refLevelsContainer = el('ref-levels-container');
    const btnAddRefLevel = el('btn-add-ref-level');
    const biniPrice = el('bini-price');
    const rankSelect = el('rank-select');
    const btnRecalc = el('btn-recalc');

    const periodLabel = el('period-label');
    const resultTabs = document.querySelectorAll('.result-tab');
    const resultPanels = document.querySelectorAll('.result-panel');
    const periodBtns = document.querySelectorAll('.period-btn');

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
        refLevels: el('ref-levels-list'),
        poolsTotal: el('pools-total'),
        poolsTotalUsd: el('pools-total-usd'),
        poolsList: el('pools-list'),
        grandTotal: el('grand-total'),
        grandTotalUsd: el('grand-total-usd'),
        brStaking: el('br-staking'),
        brReferral: el('br-referral'),
        brPools: el('br-pools'),
        brRoi: el('br-roi')
    };

    // ====== СОСТОЯНИЕ ЛИЧНЫХ СТЕЙКОВ ======
    let stakes = [
        { amount: 2500, package: 30 },
        { amount: 8300, package: 360 }
    ];

    // ====== СОСТОЯНИЕ РЕФЕРАЛОВ ПО УРОВНЯМ L1-L8 ======
    // Каждый уровень: { count, totalStakeBini }
    // По умолчанию L1, L2, L3 — пользователь может добавить ещё до L8
    let refLevels = [
        { level: 1, count: 10, totalStakeBini: 25000 },
        { level: 2, count: 15, totalStakeBini: 30000 },
        { level: 3, count: 22, totalStakeBini: 40000 }
    ];

    // Текущий выбранный период для отображения дохода (30 или 360 дней)
    let currentDisplayPeriod = 360;

    // ====== ФУНКЦИИ ФОРМАТИРОВАНИЯ ======
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

    // ====== ОТРИСОВКА ЛИЧНЫХ СТЕЙКОВ ======
    function renderStakes() {
        stakesContainer.innerHTML = '';
        stakes.forEach((s, idx) => {
            const pkg = PACKAGES[s.package];
            const row = document.createElement('div');
            row.className = 'stake-row';
            row.innerHTML = `
                <div class="stake-row__field">
                    <label>Сумма, BINI</label>
                    <input type="number" min="1" step="10" value="${s.amount}" data-stake-idx="${idx}" data-stake-field="amount">
                </div>
                <div class="stake-row__field">
                    <label>Пакет</label>
                    <select data-stake-idx="${idx}" data-stake-field="package">
                        <option value="30" ${s.package === 30 ? 'selected' : ''}>Стартовый · 30д</option>
                        <option value="90" ${s.package === 90 ? 'selected' : ''}>Рост · 90д</option>
                        <option value="180" ${s.package === 180 ? 'selected' : ''}>Pro · 180д</option>
                        <option value="360" ${s.package === 360 ? 'selected' : ''}>Elit · 360д</option>
                    </select>
                </div>
                ${stakes.length > 1 ? `<button type="button" class="stake-row__remove" data-remove-stake="${idx}" title="Удалить">✕</button>` : ''}
            `;
            stakesContainer.appendChild(row);
        });

        stakesContainer.querySelectorAll('input[data-stake-idx]').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.stakeIdx);
                const field = e.target.dataset.stakeField;
                stakes[idx][field] = parseFloat(e.target.value) || 0;
                markStale();
            });
        });
        stakesContainer.querySelectorAll('select[data-stake-idx]').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.stakeIdx);
                const field = e.target.dataset.stakeField;
                stakes[idx][field] = parseInt(e.target.value);
                markStale();
            });
        });
        stakesContainer.querySelectorAll('[data-remove-stake]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.removeStake);
                stakes.splice(idx, 1);
                renderStakes();
                markStale();
            });
        });
    }

    // ====== ОТРИСОВКА РЕФЕРАЛОВ ПО УРОВНЯМ L1-L8 ======
    function renderRefLevelsInput() {
        refLevelsContainer.innerHTML = '';
        refLevels.forEach((r, idx) => {
            const row = document.createElement('div');
            row.className = 'stake-row';
            row.innerHTML = `
                <div class="stake-row__field">
                    <label>Сколько рефералов (L${r.level})</label>
                    <input type="number" min="0" step="1" value="${r.count}" data-ref-idx="${idx}" data-ref-field="count">
                </div>
                <div class="stake-row__field">
                    <label>Суммарный стейкинг всего, BINI</label>
                    <input type="number" min="0" step="100" value="${r.totalStakeBini}" data-ref-idx="${idx}" data-ref-field="totalStakeBini">
                </div>
                ${refLevels.length > 1 ? `<button type="button" class="stake-row__remove" data-remove-ref="${idx}" title="Удалить">✕</button>` : ''}
            `;
            refLevelsContainer.appendChild(row);
        });

        refLevelsContainer.querySelectorAll('input[data-ref-idx]').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.refIdx);
                const field = e.target.dataset.refField;
                refLevels[idx][field] = parseFloat(e.target.value) || 0;
                markStale();
            });
        });
        refLevelsContainer.querySelectorAll('[data-remove-ref]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.removeRef);
                refLevels.splice(idx, 1);
                // Перенумеруем уровни
                refLevels.forEach((r, i) => r.level = i + 1);
                renderRefLevelsInput();
                markStale();
            });
        });
    }

    // ====== Подсветка "требуется пересчёт" ======
    let isStale = false;
    function markStale() {
        isStale = true;
        btnRecalc.classList.add('btn-recalc--pulse');
        btnRecalc.querySelector('span:last-child').textContent = 'ПЕРЕСЧИТАТЬ ●';
    }
    function clearStale() {
        isStale = false;
        btnRecalc.classList.remove('btn-recalc--pulse');
        btnRecalc.querySelector('span:last-child').textContent = 'ПЕРЕСЧИТАТЬ';
    }

    // ====== ЛОГИКА РАСЧЁТА ======
    function calcDailyReward(stakeUsdt, apy) {
        return stakeUsdt * (apy / 100) / 365;
    }

    function getActiveRank(totalStakeUsdt) {
        let active = RANKS[0];
        for (const r of RANKS) {
            if (totalStakeUsdt >= r.minStakeUsdt) active = r;
        }
        return active;
    }

    // ====== ОТРИСОВКА РЕЗУЛЬТАТА ======
    function render() {
        const price = parseFloat(biniPrice.value) || 0.12;
        const rankIdx = parseInt(rankSelect.value) || 0;
        const rank = RANKS[rankIdx];

        // Сумма личных стейков в BINI и USDT
        const totalStakeBini = stakes.reduce((sum, s) => sum + (s.amount || 0), 0);
        const totalStakeUsdt = totalStakeBini * price;

        // Период для отображения (30 или 360 дней)
        const displayDays = currentDisplayPeriod;
        periodLabel.textContent = `за ${displayDays} дней`;

        // === Стейкинг — считаем каждый стейк отдельно ===
        // Стейкинг доход считается на полный срок пакета, но показывается за displayDays
        const apy = STAKING_APY;
        let totalDailyBini = 0;
        // Для split-bar берём средневзвешенный split
        let weightedBonus = 0;
        let weightedSpot = 0;
        let totalStakeForWeight = 0;

        stakes.forEach(s => {
            const pkg = PACKAGES[s.package];
            const daily = calcDailyReward(s.amount, apy);  // в BINI
            totalDailyBini += daily;
            weightedBonus += pkg.bonus * s.amount;
            weightedSpot += pkg.spot * s.amount;
            totalStakeForWeight += s.amount;
        });

        const avgBonus = totalStakeForWeight > 0 ? weightedBonus / totalStakeForWeight : 0.25;
        const avgSpot = totalStakeForWeight > 0 ? weightedSpot / totalStakeForWeight : 0.75;

        // Доход за выбранный период
        const periodRewardBini = totalDailyBini * displayDays;
        const bonusPart = periodRewardBini * avgBonus;
        const spotPart = periodRewardBini * avgSpot;

        out.apyEffective.textContent = formatApy(apy);
        out.apyBase.textContent = `фиксированный APY · ${rank.code}`;
        out.stakingPeriod.textContent = `${formatNumber(periodRewardBini, 1)} BINI`;
        out.stakingPeriodUsd.textContent = `≈ ${formatUsd(periodRewardBini * price)}`;
        out.stakingDaily.textContent = `${formatNumber(totalDailyBini, 2)} BINI`;
        out.stakingDailyUsd.textContent = `≈ ${formatUsd(totalDailyBini * price)} / день`;
        out.splitBonus.textContent = `${formatNumber(bonusPart, 1)} BINI`;
        out.splitSpot.textContent = `${formatNumber(spotPart, 1)} BINI`;

        // Ширина сплит-бара
        document.querySelector('.split-bar__item--bonus').style.width = (avgBonus * 100) + '%';
        document.querySelector('.split-bar__item--spot').style.width = (avgSpot * 100) + '%';
        const bonusLabel = document.querySelector('.split-bar__item--bonus span');
        const spotLabel = document.querySelector('.split-bar__item--spot span');
        if (bonusLabel) bonusLabel.textContent = `Bonus ${(avgBonus * 100).toFixed(0)}%`;
        if (spotLabel) spotLabel.textContent = `Spot ${(avgSpot * 100).toFixed(0)}%`;

        // === Рефералы — считаем по каждому уровню L1-L8 ===
        // Для каждого уровня: доход клиентов × ставка уровня
        let totalRefIncomeBini = 0;
        const breakdown = [];

        refLevels.forEach((r, i) => {
            const level = r.level;
            if (level > rank.depth) {
                // Уровень недоступен для текущего ранга
                breakdown.push({
                    level: level,
                    count: r.count,
                    totalStakeBini: r.totalStakeBini,
                    rate: 0,
                    total: 0,
                    available: false
                });
                return;
            }
            const rate = rank.rates[level - 1] || 0;
            // Доход клиентов на этом уровне за выбранный период
            const clientDailyBini = calcDailyReward(r.totalStakeBini, apy);
            const clientPeriodBini = clientDailyBini * displayDays;
            // Выплата партнёру: clientIncome × rate
            const levelTotal = clientPeriodBini * rate;
            totalRefIncomeBini += levelTotal;
            breakdown.push({
                level: level,
                count: r.count,
                totalStakeBini: r.totalStakeBini,
                rate: rate,
                total: levelTotal,
                available: true
            });
        });

        out.refTotal.textContent = `${formatNumber(totalRefIncomeBini, 1)} BINI`;
        out.refTotalUsd.textContent = `≈ ${formatUsd(totalRefIncomeBini * price)}`;

        out.refLevels.innerHTML = '';
        breakdown.forEach((lvl) => {
            const div = document.createElement('div');
            div.className = `ref-level ref-level--l${lvl.level}`;
            if (!lvl.available) {
                div.classList.add('ref-level--unavailable');
            }
            const ratePct = (lvl.rate * 100).toFixed(lvl.rate * 100 % 1 === 0 ? 0 : 1);
            div.innerHTML = `
                <span class="ref-level__label">L${lvl.level}</span>
                <span class="ref-level__rate">${ratePct}% · ${lvl.count} чел. · ${formatNumber(lvl.totalStakeBini)} BINI${!lvl.available ? ' (не доступен на вашем ранге)' : ''}</span>
                <span class="ref-level__value">${formatNumber(lvl.total, 1)} BINI</span>
            `;
            out.refLevels.appendChild(div);
        });

        // === Лидерские пулы ===
        // Командный объём = суммарный стейк всех рефералов в USDT
        const teamVolumeUsd = refLevels.reduce((sum, r) => sum + r.totalStakeBini * price, 0);

        // Оценка прибыли компании за период (30 дней = 1 месяц)
        const monthsInPeriod = displayDays / 30;
        const companyProfitPeriod = ESTIMATED_COMPANY_PROFIT_PER_MONTH_USD * monthsInPeriod;

        // Определяем квалификацию по пулам
        let poolsTotalUsd = 0;
        const poolsBreakdown = [];

        LEADER_POOLS.forEach(pool => {
            if (teamVolumeUsd >= pool.minVolumeUsd) {
                // Квалифицирован. Оценка бонуса = pool.share × companyProfit / N участников
                // Допущение: 100 участников в каждом пуле (типичное значение для ранних пулов)
                const estimatedParticipants = 100;
                const poolBonusUsd = (pool.share * companyProfitPeriod) / estimatedParticipants;
                poolsTotalUsd += poolBonusUsd;
                poolsBreakdown.push({
                    pool: pool.pool,
                    share: pool.share,
                    minVolumeUsd: pool.minVolumeUsd,
                    qualified: true,
                    bonusUsd: poolBonusUsd
                });
            } else {
                poolsBreakdown.push({
                    pool: pool.pool,
                    share: pool.share,
                    minVolumeUsd: pool.minVolumeUsd,
                    qualified: false,
                    bonusUsd: 0,
                    neededUsd: pool.minVolumeUsd - teamVolumeUsd
                });
            }
        });

        out.poolsTotal.textContent = `${formatUsd(poolsTotalUsd)}`;
        out.poolsTotalUsd.textContent = `≈ ${formatNumber(poolsTotalUsd / price, 1)} BINI`;

        out.poolsList.innerHTML = '';
        poolsBreakdown.forEach(p => {
            const div = document.createElement('div');
            div.className = `ref-level ${p.qualified ? 'ref-level--l1' : 'ref-level--unavailable'}`;
            if (p.qualified) {
                div.innerHTML = `
                    <span class="ref-level__label">Пул ${p.pool}</span>
                    <span class="ref-level__rate">${(p.share * 100).toFixed(0)}% · квалифицирован (объём ${formatUsd(teamVolumeUsd)})</span>
                    <span class="ref-level__value">${formatUsd(p.bonusUsd)}</span>
                `;
            } else {
                div.innerHTML = `
                    <span class="ref-level__label">Пул ${p.pool}</span>
                    <span class="ref-level__rate">${(p.share * 100).toFixed(0)}% · нужен объём от ${formatUsd(p.minVolumeUsd)}, не хватает ${formatUsd(p.neededUsd)}</span>
                    <span class="ref-level__value">—</span>
                `;
            }
            out.poolsList.appendChild(div);
        });

        // === Итог ===
        const stakingIncomeUsd = periodRewardBini * price;
        const referralIncomeUsd = totalRefIncomeBini * price;
        const grandTotalUsd = stakingIncomeUsd + referralIncomeUsd + poolsTotalUsd;
        const grandTotalBini = grandTotalUsd / price;
        const roi = totalStakeUsdt > 0 ? (grandTotalUsd / totalStakeUsdt * 100) : 0;

        out.grandTotal.textContent = `${formatNumber(grandTotalBini, 1)} BINI`;
        out.grandTotalUsd.textContent = `≈ ${formatUsd(grandTotalUsd)}`;
        out.brStaking.textContent = `${formatNumber(periodRewardBini, 1)} BINI`;
        out.brReferral.textContent = `${formatNumber(totalRefIncomeBini, 1)} BINI`;
        out.brPools.textContent = `${formatUsd(poolsTotalUsd)}`;
        out.brRoi.textContent = `ROI ${formatNumber(roi, 0)}%`;

        clearStale();
    }

    // ====== СОБЫТИЯ ======
    btnAddStake.addEventListener('click', () => {
        stakes.push({ amount: 830, package: 180 });
        renderStakes();
        markStale();
    });

    btnAddRefLevel.addEventListener('click', () => {
        const nextLevel = refLevels.length + 1;
        if (nextLevel > 8) {
            alert('Максимум 8 уровней рефералов (L1-L8)');
            return;
        }
        refLevels.push({ level: nextLevel, count: 0, totalStakeBini: 0 });
        renderRefLevelsInput();
        markStale();
    });

    btnRecalc.addEventListener('click', () => {
        render();
        const icon = btnRecalc.querySelector('.btn-recalc__icon');
        icon.style.transition = 'transform 0.5s';
        icon.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            icon.style.transition = 'none';
            icon.style.transform = 'rotate(0deg)';
        }, 500);
    });

    resultTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            resultTabs.forEach(t => t.classList.remove('result-tab--active'));
            resultPanels.forEach(p => p.classList.remove('result-panel--active'));
            tab.classList.add('result-tab--active');
            el('panel-' + tab.dataset.tab).classList.add('result-panel--active');
        });
    });

    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            periodBtns.forEach(b => b.classList.remove('period-btn--active'));
            btn.classList.add('period-btn--active');
            currentDisplayPeriod = parseInt(btn.dataset.period);
            render();
        });
    });

    [biniPrice, rankSelect].forEach(input => {
        input.addEventListener('input', markStale);
        input.addEventListener('change', markStale);
    });

    // Стартовая отрисовка
    renderStakes();
    renderRefLevelsInput();
    render();
})();
