# EcoGuardian Frontend — Design System Reference (v3 transport relabel)

Use these shared tokens for ALL page redesigns. Work is FRONTEND-ONLY. Do NOT touch
`backend/`, `ml-service/`, `services/api.js`, API contracts, or any data logic.
Do NOT change data-fetching behavior — only presentation and class/structure.

## Product identity
"Personal Mobility Intelligence". Communicate mobility intelligence, personal behavior,
transportation emissions, personalized prediction, explainable ML, Mobility Twin,
scenario simulation, actionable mobility decisions. NOT a generic carbon calculator.

## Non-negotiables
- NO EMOJIS anywhere in the UI. Replace emoji icons with Feather (react-icons/fi) icons.
- NO glassmorphism: no `backdrop-blur`, no translucent `bg-white/30`, no `glass` glow cards.
- NO decorative green blobs, excessive gradients, or glowing boxes. Color = semantic signal only:
  - GREEN (eco) = positive / improvement / emissions-aware accent
  - AMBER (warn) = caution
  - RED (high) = critical / high emission / error
  - SLATE/NEUTRAL (ink) = default surfaces & text
- AVOID huge rounded cards / balloon radii. Use small radii (rounded-lg/xl, i.e. 0.5–0.75rem).
- Only show confidence/uncertainty when the backend actually provides it. NEVER invent numbers,
  savings, SHAP explanations, or predictions. Render what the API returns.
- Restrained, technical, trustworthy, data-driven. Clean hierarchy via typography/spacing.
- Replace `green-*`/`gray-*`/`bg-slate-*`/`text-gray-*` Tailwind classes with the ink/eco system below.

## Color tokens (Tailwind theme — all available)
- Neutrals: `ink-50..950` (gray/slate family). Text: `text-ink-700` (body), `text-ink-900` dark:`text-white` (headings). Muted: `text-ink-400/500` (`dark:text-ink-500/400`).
- Surfaces: `bg-white`, `bg-surface-1` (page bg), `bg-surface-2`, border `border-ink-200` (`dark:border-ink-800`).
- Semantic accent: `eco-50..950`. Positive/improvement text `text-eco-600` (`dark:text-eco-400`), accent bg `bg-eco-600`.
- Caution: `warn-50..950`. Critical: `high-50..950`.
- Info accents: `ocean-50..950`.
- Chart categorical: `bg-graph-primary|info|amber|slate|violet|teal`.

## Dark mode
- Toggle `.dark` on `<html>` (global). Use `dark:` variants. `dark:bg-ink-900` (cards), `dark:bg-ink-950` (page), `dark:border-ink-800`.

## Reusable component classes (in index.css)
- `.card` — surface with border + subtle shadow. `.card p-5` with padding.
- `.btn-primary` (dark solid), `.btn-accent` (green), `.btn-secondary` (outline), `.btn-danger`.
- `.input-field` + `.input-label` for form fields.
- `.nav-link` / `.nav-link-active` for nav.
- `.badge-eco|amber|red|blue|neutral`.
- `.section-label`, `.data-table`, `.tab-strip`/`.tab-item-active`, `.divider`, `.progress-track`/`.progress-fill`.
- `.modal-overlay`/`.modal-box`, `.skeleton`, `.kpi-value`, `.kpi-label`, `.eco-text`.
- Do NOT rely on `rounded-2xl/3xl` heavy radii; prefer `rounded-lg`/`rounded-xl`.

## Layout / spacing
- Pages render plain content (the global `Layout` in App.jsx wraps all routes — page components must NOT import or render `<Layout>` themselves).
- Max content width for authenticated pages ~`max-w-5xl`/`max-w-7xl mx-auto`.
- Use section headings: eyebrow (small uppercase, `text-eco-700 dark:text-eco-400`, tracking-wide) + `h1` (`text-2xl/3xl font-bold text-ink-900 dark:text-white`).
- KPI cards: grid `grid-cols-2 sm:grid-cols-4 gap-4`, each `.card p-5` with label + bold value + unit.

## Tremendously important verification (ALWAYS do this)
After editing a page, run from `frontend/`:
  npm run build
and confirm it succeeds (no missing-icons errors like "FiFoo is not exported"). If a react-icons/fi
icon is not exported, swap it for a valid one (FiNavigation, FiMapPin, FiActivity, FiTrendingUp, etc.).
Then, if a Vite dev server is running on :5173, open the page in Playwright at 1440 and 375px and confirm
it renders with no console errors and no horizontal overflow (document.documentElement.scrollWidth <= innerWidth).
