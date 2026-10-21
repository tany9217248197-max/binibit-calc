/* =====================================================
   BiNiBit Calculator — логика расчёта v3
   Источники: binibit.com/ru/earn/affiliate (октябрь 2026)
              binibit.com/ru/staking (октябрь 2026)
   ===================================================== */

(function () {
    'use strict';

    // ====== КОНСТАНТЫ СТЕЙКИНГА (binibit.com/ru/staking) ======
    // APY 120% для всех пакетов; множителей нет.
    // Split Bonus/Spot зависит от срока блокировки.
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

    const BRANCHING_FACTOR = 1.5;

    // ====== DOM ======
    const el = (id) => document.getElementById(id);
    const stakesContainer = el('stakes-container');
    const btnAddStake = el('btn-add-stake');
    const biniPrice = el('bini-price');
    const referralCount = el('referral-count');
    const referralStake = el('referral-stake');
    const rankSelect = el('rank-select');
    const btnRecalc = el('btn-recalc');

    const periodLabel = el('period-label');
    const resultTabs = document.querySelectorAll('.result-tab');
    const resultPanels = document.querySelectorAll('.result-panel');

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

    // ====== СОСТОЯНИЕ ЛИЧНЫХ СТЕЙКОВ ======
    // По умолчанию: один на 30 дней ($300), другой на 360 дней ($1000)
    // Как просила Лида — у неё два разных стейка
    let stakes = [
        { amount: 300,  package: 30 },
        { amount: 1000, package: 360 }
    ];

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
                    <label>Сумма, USDT</label>
                    <input type="number" min="10" step="10" value="${s.amount}" data-stake-idx="${idx}" data-stake-field="amount">
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
                ${stakes.length > 1 ? `<button type="button" class="stake-row__remove" data-remove-idx="${idx}" title="Удалить">✕</button>` : ''}
            `;
            stakesContainer.appendChild(row);
        });

        // Привязка событий к новым элементам
        stakesContainer.querySelectorAll('input[data-stake-idx]').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.stakeIdx);
                const field = e.target.dataset.stakeField;
                stakes[idx][field] = parseFloat(e.target.value) || 0;
                // Авто-расчёт при изменении не запускаем — пользователь просил кнопку ПЕРЕСЧИТАТЬ
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
        stakesContainer.querySelectorAll('[data-remove-idx]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.removeIdx);
                stakes.splice(idx, 1);
                renderStakes();
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

    function calcReferralTree(directCount, depth) {
        const tree = [];
        let count = directCount;
        for (let i = 0; i < depth; i++) {
            tree.push({ level: i + 1, count: count });
            count = Math.floor(count * BRANCHING_FACTOR);
            if (count === 0) break;
        }
        return tree;
    }

    // ====== ОТРИСОВКА РЕЗУЛЬТАТА ======
    function render() {
        const price = parseFloat(biniPrice.value) || 0.12;
        const refCount = parseInt(referralCount.value) || 0;
        const refStakeUsdt = parseFloat(referralStake.value) || 0;
        const rankIdx = parseInt(rankSelect.value) || 0;
        const rank = RANKS[rankIdx];

        // Сумма личных стейков
        const totalStakeUsdt = stakes.reduce((sum, s) => sum + (s.amount || 0), 0);

        // Период для отображения — берём максимальный из стейков (для периода отображения дохода)
        // Но считаем каждый стейк отдельно со своим периодом
        const maxLockDays = Math.max(...stakes.map(s => PACKAGES[s.package].lockDays));
        periodLabel.textContent = `за ${maxLockDays} дней (макс. пакет)`;

        // === Стейкинг — считаем каждый стейк отдельно ===
        const apy = STAKING_APY;
        let totalDaily = 0;
        let totalPeriodReward = 0;
        let totalBonus = 0;
        let totalSpot = 0;

        // Для split-bar берём средневзвешенный split
        let weightedBonus = 0;
        let weightedSpot = 0;
        let totalStakeForWeight = 0;

        stakes.forEach(s => {
            const pkg = PACKAGES[s.package];
            const daily = calcDailyReward(s.amount, apy);
            const period = daily * pkg.lockDays;
            totalDaily += daily;
            totalPeriodReward += period;
            totalBonus += period * pkg.bonus;
            totalSpot += period * pkg.spot;
            weightedBonus += pkg.bonus * s.amount;
            weightedSpot += pkg.spot * s.amount;
            totalStakeForWeight += s.amount;
        });

        const avgBonus = totalStakeForWeight > 0 ? weightedBonus / totalStakeForWeight : 0.25;
        const avgSpot = totalStakeForWeight > 0 ? weightedSpot / totalStakeForWeight : 0.75;

        out.apyEffective.textContent = formatApy(apy);
        out.apyBase.textContent = `фиксированный APY · ${rank.code}`;
        out.stakingPeriod.textContent = `${formatUsd(totalPeriodReward)}`;
        out.stakingPeriodUsd.textContent = `${formatNumber(totalPeriodReward / price, 1)} BINI`;
        out.stakingDaily.textContent = `${formatUsd(totalDaily)}`;
        out.stakingDailyUsd.textContent = `${formatNumber(totalDaily / price, 2)} BINI/день`;
        out.splitBonus.textContent = `${formatUsd(totalBonus)}`;
        out.splitSpot.textContent = `${formatUsd(totalSpot)}`;

        // Ширина сплит-бара — средневзвешенная
        document.querySelector('.split-bar__item--bonus').style.width = (avgBonus * 100) + '%';
        document.querySelector('.split-bar__item--spot').style.width = (avgSpot * 100) + '%';
        const bonusLabel = document.querySelector('.split-bar__item--bonus span');
        const spotLabel = document.querySelector('.split-bar__item--spot span');
        if (bonusLabel) bonusLabel.textContent = `Bonus ${(avgBonus * 100).toFixed(0)}%`;
        if (spotLabel) spotLabel.textContent = `Spot ${(avgSpot * 100).toFixed(0)}%`;

        // === Рефералы ===
        const tree = calcReferralTree(refCount, rank.depth);
        const clientDaily = calcDailyReward(refStakeUsdt, apy);
        // Период для расчёта реферальных берем максимальный — клиент стейкает на максимальный пакет
        const refPeriod = clientDaily * maxLockDays;

        let totalRefIncome = 0;
        const breakdown = tree.map((node, i) => {
            const rate = rank.rates[i] || 0;
            const perClient = refPeriod * rate;
            const levelTotal = node.count * perClient;
            totalRefIncome += levelTotal;
            return {
                level: node.level,
                count: node.count,
                rate: rate,
                perClient: perClient,
                total: levelTotal
            };
        });

        out.refTotal.textContent = `${formatUsd(totalRefIncome)}`;
        out.refTotalUsd.textContent = `${formatNumber(totalRefIncome / price, 1)} BINI`;

        out.refLevels.innerHTML = '';
        breakdown.forEach((lvl) => {
            const div = document.createElement('div');
            div.className = `ref-level ref-level--l${lvl.level}`;
            const ratePct = (lvl.rate * 100).toFixed(lvl.rate * 100 % 1 === 0 ? 0 : 1);
            div.innerHTML = `
                <span class="ref-level__label">L${lvl.level}</span>
                <span class="ref-level__rate">${ratePct}% · линия ${lvl.level}</span>
                <span class="ref-level__count">${formatNumber(lvl.count)} чел.</span>
                <span class="ref-level__value">${formatUsd(lvl.total)}</span>
            `;
            out.refLevels.appendChild(div);
        });

        // === Итог ===
        const grandTotal = totalPeriodReward + totalRefIncome;
        const grandBini = grandTotal / price;
        const roi = totalStakeUsdt > 0 ? (grandTotal / totalStakeUsdt * 100) : 0;

        out.grandTotal.textContent = `${formatUsd(grandTotal)}`;
        out.grandTotalUsd.textContent = `${formatNumber(grandBini, 1)} BINI`;
        out.brStaking.textContent = `${formatUsd(totalPeriodReward)}`;
        out.brReferral.textContent = `${formatUsd(totalRefIncome)}`;
        out.brRoi.textContent = `ROI ${formatNumber(roi, 0)}%`;

        clearStale();
    }

    // ====== СОБЫТИЯ ======
    btnAddStake.addEventListener('click', () => {
        stakes.push({ amount: 100, package: 180 });
        renderStakes();
        markStale();
    });

    btnRecalc.addEventListener('click', () => {
        render();
        // Эффект "вращения" иконки
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

    [biniPrice, referralCount, referralStake, rankSelect].forEach(input => {
        input.addEventListener('input', markStale);
        input.addEventListener('change', markStale);
    });

    // Стартовая отрисовка
    renderStakes();
    render();
})();
