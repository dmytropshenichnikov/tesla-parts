# STATUS — Tesla Parts Center

Оновлено: 2026-09-16. Продакшн-деплой: `main` = `feature/improvements` = `7c197d6`.

## URL та доступ
- Shop: https://teslapartscenter.com.ua
- Admin: https://admin.teslapartscenter.com.ua (admin / admin123)
- API: https://api.teslapartscenter.com.ua (+ `/api/` same-origin проксі на домені магазину)
- Сервер: `ssh dmytropshenichnikov` → `/var/www/tesla-parts` (docker: gateway, shop, admin, backend, db)

## Правила проєкту
- Категорії каталогу — джерело істини. Схеми (EPC) і товари привʼязані до категорій/підкатегорій.
- **Ніколи не змішувати** «Model 3» і «Model 3 Highland» (та інші покоління) ні в каталозі, ні в схемах.
- Деплой — тільки через `./deploy/deploy.sh` (перевіряє гілку, чистоту дерева, сам мерджить `feature/improvements` у `main`).
- Ручні (непривʼязані) варіанти показують «Немає в наявності» без ціни й кошика; привʼязані беруть ціну/наявність з каталогу.
- Локальний скрипт вивірки: Playwright + системний Chrome (див. нижче).

## Зроблено (актуальний цикл)
- Картки вибору авто на сторінці схем тепер як на головній каталогу: великі фото 3-в-ряд,
  градієнт, назва моделі, «Переглянути схеми →», бейдж кількості схем.
- У навбарі біля «Каталог» додано іконку (Grid2x2, tesla-red) — desktop і mobile.
- Перевірено на проді: крок 1 (6 карток), крок 2 (розділ), крок 3 (вузли + деталі вузла з цінами),
  порожній стан для моделі без схем, мобільна верстка 390px. Помилок консолі немає.

## Команди вивірки
```bash
cd tesla-parts-shop      && npx tsc --noEmit && npm run build
cd tesla-parts-admin     && npx tsc --noEmit && npm run build
cd tesla-parts-backend   && python3 -m py_compile main.py routers/*.py
# деплой на сервері
ssh dmytropshenichnikov 'cd /var/www/tesla-parts && git fetch -q origin && git reset -q --hard origin/main && ./deploy/deploy.sh'
```

## Відкриті питання
- Наповнення схемами: зараз у БД один приклад (Model 3 Highland → ЗОВНІШНЄ ОЗДОБЛЕННЯ → ЗАХИСТИ ПЕРЕДНІ).
