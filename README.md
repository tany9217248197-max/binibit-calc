# BiNiBit Calculator — лид-магнит для привлечения пользователей

Интерактивный калькулятор доходности стейкинга **BINI** и партнёрской программы BiNiBit. Параметры — из официальных условий [binibit.com/ru/earn/affiliate](https://binibit.com/ru/earn/affiliate) и [binibit.com/ru/staking](https://binibit.com/ru/staking) (октябрь 2026).

## Что считает

- **Стейкинг BINI**: 4 тира (30 / 90 / 180 / 360 дней), фиксированный APY 120%
- **Split Bonus/Spot** (55/45, 35/65, 25/75, 15/85) — по сроку блокировки
- **Партнёрская программа**: 8 рангов (CADET → TOPGUN), 8 уровней L1-L8, до 30% суммарно
- **Лидерские пулы**: 7 пулов, 35% прибыли компании
- **ROI** к вложенной сумме в USDT и BINI

## Источники данных

| Параметр | Источник |
|---|---|
| Тиры стейкинга | [binibit.com/ru/staking](https://binibit.com/ru/staking) |
| APY 120% | [binibit.com/ru/staking](https://binibit.com/ru/staking) |
| Ранги и уровни L1-L8 | [binibit.com/ru/earn/affiliate](https://binibit.com/ru/earn/affiliate) |
| Лидерские пулы | [binibit.com/ru/earn/affiliate](https://binibit.com/ru/earn/affiliate) |
| Бренд-цвета | [binibit.com](https://binibit.com) (`#0b0e11`, `#36d9ff`, `#68e67b`, `#ffd44d`) |

## Технологии

- Чистый HTML + CSS + JavaScript, без сборки
- Никаких внешних библиотек и зависимостей
- Адаптив под мобильные (390px и шире)
- Работает офлайн после первой загрузки

## Запуск локально

```bash
# Любой способ — открыть прямо в браузере:
open index.html      # macOS
xdg-open index.html  # Linux
start index.html     # Windows

# Или через локальный сервер:
python3 -m http.server 8000
# → http://localhost:8000
```

## Деплой на GitHub Pages

Файл `.github/workflows/deploy.yml` уже настроен. После push в ветку `main` страница автоматически публикуется по адресу:

```
https://<username>.github.io/binibit-calc/
```

## Структура проекта

```
binibit-calc/
├── index.html              # Структура страницы
├── styles.css              # Фирменный тёмный стиль BiNiBit
├── app.js                  # Логика расчётов
├── .github/workflows/
│   └── deploy.yml          # Авто-деплой на GitHub Pages
├── README.md               # Этот файл
└── .gitignore
```

## Дисклеймер

Калькулятор показывает математическую модель на основе официальных условий BiNiBit (октябрь 2026). **Не является финансовой рекомендацией.** Реальные выплаты зависят от фактической доходности, поведения рефералов, рыночной цены BINI и квалификации.

## Лицензия

MIT — можно использовать, модифицировать, распространять.
