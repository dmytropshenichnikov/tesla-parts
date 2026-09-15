# Tesla Parts Project

## Stack
- **Backend:** FastAPI, SQLModel, PostgreSQL (prod) / SQLite (dev), JWT Auth.
- **Frontend (Admin & Shop):** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Deployment:** Docker, Nginx, Vercel/Render support.

## Project Structure
- `tesla-parts-backend/`: API server.
  - `routers/`: Endpoint definitions.
  - `services/`: Business logic (Telegram, Pricing, Images).
  - `models.py`: Database models (SQLModel).
  - `schemas.py`: Pydantic schemas for API validation.
- `tesla-parts-admin/`: React-based administration dashboard.
- `tesla-parts-shop/`: Public-facing React storefront.
- `docker-compose.yml`: Local development environment orchestration.

## Coding Standards

### General
- **Naming:** CamelCase for React components, camelCase for TS variables/functions, snake_case for Python.
- **Types:** Use TypeScript strictly; avoid `any`. Define shared types in `types.ts`.
- **Styling:** Use Tailwind CSS. Stick to the project's color palette (Tesla red, grays).

### Backend (FastAPI)
- Use **SQLModel** for both models and schemas where possible, or Pydantic for API-specific schemas.
- Place business logic in `services/`, keep routers thin.
- Use dependency injection for DB sessions and auth.

### Frontend (React)
- Functional components with `React.FC`.
- Use `lucide-react` for icons.
- Prefer explicit composition over complex inheritance.
- API calls should be centralized in `services/api.ts`.

## Critical Architectural & Analytics Safeguards (DO NOT BREAK)

1. **GTM Script Position (`tesla-parts-shop/index.html`):**
   - The GTM snippet (`GTM-W2HKHCLB`) must remain a classic synchronous `<script>` **ABOVE the `importmap` block**. Moving it below or making it `type="module"` will break importmap loading and result in a blank React screen.

2. **Event Tracking in `addToCart` (`tesla-parts-shop/App.tsx`):**
   - `trackAddToCart` must be called BEFORE `setCart` and **NEVER inside the `setCart((prev) => ...)` updater callback**. React 18+ may run updater callbacks multiple times.
   - Do NOT reference `effectiveRate` inside `addToCart`. Use `uahPerUsd` (or fallback `DEFAULT_EXCHANGE_RATE_UAH_PER_USD`). Always run `npx tsc --noEmit`.

3. **`view_item` Effect Dependencies (`tesla-parts-shop/components/ProductPage.tsx`):**
   - The `useEffect` for `trackViewItem` must be keyed ONLY on `[product.id]`. Do NOT add `effectiveRate` to dependencies, as exchange rate updates will trigger duplicate `view_item` events.

4. **GA4 Ecommerce & Merchant Center Matching (`tesla-parts-shop/utils/analytics.ts`):**
   - `item_id` in `gaItem` MUST equal `product.id` to match `g:id` in the Google Merchant Center feed for dynamic remarketing.
   - All analytics trackers must be wrapped in `try/catch` so analytics errors never blank the page or crash cart/checkout.
   - NEVER send PII (name, phone, address, note) to GTM / GA4.

5. **No Double Promo Discount (`tesla-parts-backend/routers/orders.py`):**
   - The frontend in `Checkout.tsx` calculates `totalUSD` with promo discount applied. The backend must validate the promo code, but MUST NOT apply the discount percentage/amount a second time if `totalUSD > 0`.

6. **Schematics Models/Generations Come From Categories (`category` table) — DO NOT HARDCODE:**
   - `GET /schematics/model-options` builds the model/generation lists from the `category` table. Both
     `tesla-parts-admin/components/SchematicManager.tsx` and
     `tesla-parts-shop/components/SchemesCatalog.tsx` consume it.
   - Never reintroduce constant arrays like `TESLA_MODELS` / `GENERATIONS_BY_MODEL` in the frontends.
   - A category that is a strict prefix of another («Model 3» → «Model 3 Highland») is treated as the base
     model; the remainder is the generation. `list_schematics` resolves such compound names generically.
   - A schematic row stores the **base** model in `schematic.model` (e.g. `Model 3`) plus the generation
     (e.g. `Highland (2024-...)`); storing the category name itself would break filtering.
   - Category names containing «аксесуар» are accessory categories: they get the universal generation and
     are listed last in the admin/shop pickers.

## Core Workflows
- **Migrations:** Use provided migration scripts (`migrate_*.py`) for DB schema updates.
- **Testing:** Run backend tests with `.venv/bin/pytest` and frontend typechecks with `npx tsc --noEmit`.
- **Deployment:** Follow `DEPLOYMENT.md` for standard procedures.
