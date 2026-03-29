

# Auth Error Banner + Lazy Loading

## 1. Auth error banner on login page (`src/pages/AdminLogin.tsx`)

- Add `authError` state to track session/role check failures
- Read URL search params (e.g. `?error=access_denied`) set by `AdminLayout` when redirecting unauthorized users
- Display an `Alert` (destructive variant) above the form with the error message and a "Retry" button that clears the error and reloads the session
- Also show inline error banner when login fails (replacing or supplementing the toast)

Update `AdminLayout.tsx` to redirect with an error query param when access is denied:
- `if (!user)` → redirect to `/login?error=session_expired`
- `if (!isAdmin)` → redirect to `/login?error=access_denied`

## 2. Route-level lazy loading (`src/App.tsx`)

- Replace all 8 admin page static imports with `React.lazy()` + dynamic `import()`
- Wrap the `<Routes>` (or individual routes) with `<Suspense fallback={<Skeleton layout />}>`
- Keep `AdminLogin`, `AdminLayout`, and `NotFound` as eager imports (small, critical path)

Lazy-loaded pages:
- `DashboardHome`
- `ProductManagement`
- `InventoryManagement`
- `OrderManagement`
- `CouponManagement`
- `HeroCarouselManager`
- `TestimonialsManager`
- `NewsletterManager`

## Files changed

| File | Change |
|------|--------|
| `src/App.tsx` | Replace static imports with `React.lazy`, add `Suspense` |
| `src/pages/AdminLogin.tsx` | Add error banner with retry, read URL params |
| `src/components/AdminLayout.tsx` | Pass error context via redirect URL params |

