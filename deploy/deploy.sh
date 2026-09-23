#!/usr/bin/env bash
#
# Єдина точка деплою Tesla Parts Center.
#
# Правило проєкту: продакшн живе на гілці `main`. Будь-яка робота ведеться у
# `feature/*`, і перед деплоєм вливається в `main`.
#
# Навіщо цей скрипт: 2026-09-16 сервер перемкнули на `main`, який на той момент
# відставав, і правки адмінки тихо зникли з прода. Скрипт перевіряє таку
# ситуацію сам: якщо в `feature/improvements` є зміни, яких немає в `main`, він
# їх вливає ПЕРЕД збіркою — втратити чиюсь роботу неможливо.
#
# Використання:
#   ./deploy/deploy.sh                 # зібрати й підняти backend + admin + shop
#   ./deploy/deploy.sh admin shop      # лише вказані сервіси
#   ./deploy/deploy.sh --check         # нічого не збирати, лише перевірити стан
#
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"

BRANCH="main"
UPSTREAM_BRANCH="feature/improvements"
COMPOSE="docker compose"

CHECK_ONLY=0
if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=1
  shift
fi
SERVICES=("$@")
if [ ${#SERVICES[@]} -eq 0 ]; then
  SERVICES=(backend admin shop)
fi

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mПОМИЛКА: %s\033[0m\n' "$*" >&2; exit 1; }

log "Проєкт: $PROJECT_DIR"

# --- 1. Перевіряємо стан репозиторію -----------------------------------------
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "це не git-репозиторій"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  die "сервер стоїть на гілці '$CURRENT_BRANCH', а деплой має йти з '$BRANCH'.
     Виконай:  git checkout $BRANCH && git pull --ff-only origin $BRANCH
     (перемикати продакшн на feature-гілку вручну не можна — саме так зникали правки)"
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  die "у робочій копії є незакомічені зміни — спочатку закоміть або відкоти їх:
$(git status --short)"
fi

log "Підтягую зміни з origin"
# GitHub інколи відмовляє на секунду («Permission denied (publickey)»), і тоді
# `git fetch` тихо лишає СТАРИЙ origin/main: скрипт далі збирав старий код і
# писав «Готово». Тому пробуємо кілька разів і падаємо, якщо не вдалось.
fetch_ok=0
for attempt in 1 2 3 4 5; do
  if git fetch --all --prune; then
    fetch_ok=1
    break
  fi
  warn "не вдалось підтягнути з origin (спроба $attempt/5) — повторюю за 5 с"
  sleep 5
done
[ "$fetch_ok" -eq 1 ] || die "не вдалось оновити код з origin — деплой скасовано, щоб не залити стару версію.
     Перевір доступ до GitHub із сервера:  ssh -T git@github.com"

log "Оновлюю $BRANCH"
git merge --ff-only "origin/$BRANCH" >/dev/null || die "гілка $BRANCH розійшлася з origin/$BRANCH — потрібне ручне втручання"

# Страховка від «тихого» деплою не того коду: те, що зібрали, мусить бути
# рівно тим, що лежить в origin.
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]; then
  die "HEAD ($(git log --oneline -1)) не збігається з origin/$BRANCH ($(git log --oneline -1 "origin/$BRANCH"))"
fi

# --- 2. Страховка: не загубити роботу з feature-гілки ------------------------
if ! git diff --quiet HEAD "origin/$UPSTREAM_BRANCH"; then
  warn "у '$UPSTREAM_BRANCH' є зміни, яких немає в '$BRANCH' — вливаю їх, щоб вони не зникли з прода"
  git merge --no-ff "origin/$UPSTREAM_BRANCH" -m "chore(deploy): merge $UPSTREAM_BRANCH into $BRANCH"
fi

log "Деплоїться коміт: $(git log --oneline -1)"

if [ "$CHECK_ONLY" -eq 1 ]; then
  log "Режим --check: збірка не запускалась"
  $COMPOSE ps
  exit 0
fi

# --- 3. Збірка та запуск -----------------------------------------------------
log "Збираю: ${SERVICES[*]}"
$COMPOSE build "${SERVICES[@]}"

log "Піднімаю: ${SERVICES[*]}"
$COMPOSE up -d "${SERVICES[@]}"

# --- 4. Якщо змінювався nginx-шлюз — перезавантажуємо його -------------------
if git diff --name-only "HEAD@{1}" HEAD 2>/dev/null | grep -q '^nginx-gateway/'; then
  log "Конфіг nginx змінився — перевіряю та перезавантажую шлюз"
  $COMPOSE exec -T gateway nginx -t
  $COMPOSE exec -T gateway nginx -s reload
fi

# --- 5. Перевірка ------------------------------------------------------------
log "Стан контейнерів"
$COMPOSE ps

log "Перевірка відповідей"
sleep 5
for url in \
  "https://teslapartscenter.com.ua/" \
  "https://admin.teslapartscenter.com.ua/" \
  "https://api.teslapartscenter.com.ua/vin/models" \
  "https://teslapartscenter.com.ua/api/vin/models"
do
  code="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$url" || echo 000)"
  printf '  %-55s %s\n' "$url" "$code"
  [ "$code" = "200" ] || warn "очікувався 200 від $url"
done

log "Готово"
