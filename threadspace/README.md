# ThreadSpace

One multi-tenant web app for independent clothing brands: a public landing page, a public storefront per brand,
a private dashboard per brand, and an owner dashboard for the platform operator.

Stack: React + TypeScript (Vite), Tailwind CSS, Supabase (Postgres, Auth, Storage, Row Level Security), Netlify.

The platform name is `VITE_PLATFORM_NAME` (default "ThreadSpace"); change it without touching code.

## Build status

| Area | Status |
| --- | --- |
| Database schema, RLS, Storage policies, order and owner functions | Done and applied to the `clothing-store-platform` project |
| Login, sessions, route guards, Netlify routing | Done |
| Public homepage | Done |
| Owner dashboard (`/owner`, stores, new store, store detail, members) | Done |
| Client dashboard shell and overview (`/dashboard`) | Done |
| Client products (add, edit, delete, search, filter), multi-photo upload with cover, sizes/colors/stock, draft or published | Done |
| Client inventory screen (stock by size and color, low/out filters) | Done |
| Public storefront (per-brand colors, banner, featured, new arrivals, categories, search, sort), product pages with gallery and size/color picker, cart, checkout, order confirmation | Done |
| Client orders (search, filters, detail, order and payment status, cancel) | Done |
| Client store settings (logo, banner, brand colors with preview, storefront text, shipping, payment methods and instructions, contact and social links) | Done |

All planned screens are built. Remaining work is hardening and polish (see Known limits).

Shopper flow: `/store/<slug>` > product page > cart > checkout > `/order-confirmation/<reference>`. The cart holds one store's items at a time
(stored in the browser). Prices, stock and totals are always recalculated by the database in `place_order`; the browser's numbers are for display only.
The order confirmation is looked up by its random reference and never returns the customer's phone, email or address.

## Run locally

```bash
npm install
cp .env.example .env     # then fill in the two Supabase values
npm run dev
```

`npm run build` type-checks and produces `dist/`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Your project URL, `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The **publishable** key (or legacy anon key). Never a secret/service-role key |
| `VITE_PLATFORM_NAME` | Optional. Brand name shown across the site |
| `VITE_CONTACT_EMAIL`, `VITE_CONTACT_PHONE`, `VITE_FACEBOOK_URL`, `VITE_INSTAGRAM_URL` | Optional. Shown in the homepage contact section and footer |

## Database

Migrations live in `supabase/migrations/` and have **already been applied** to `clothing-store-platform`.
To rebuild the same setup on a fresh Supabase project, run them in order in the SQL editor. They assume the original
`stores`, `store_members` and `products` tables and the `product-images` bucket exist.

Owner account: create your user in Supabase (Authentication > Users > Add user, Auto Confirm User), then run
`supabase/owner-setup.sql` with your email. There is deliberately no sign-up screen and no way to become owner from the browser.

How access works:
- Visitors read only published products and active stores. Draft products and suspended/archived stores are invisible to them.
- Members manage only stores they belong to, and only while the store is active. They cannot change a store's slug or status,
  cannot move a product to another store, and cannot grant memberships.
- Only the owner (a row in `platform_owners`) can create stores, suspend/archive them, and assign or remove members.
- Orders can only be created through the `place_order` function. It takes prices from the database, locks stock rows and
  creates the order in one transaction. Members can read their own store's orders and update only the order and payment status.
- Cancelling an order puts its stock back; a cancelled order cannot be reopened.
- Images are stored as `{store_uuid}/{filename}` in `product-images` (5 MB, JPEG/PNG/WebP/AVIF/GIF). The bucket is public, so anyone with
  an image URL can open it, including images of draft products.

## Deploy to Netlify

1. Push this folder to a Git repository and import it in Netlify. `netlify.toml` already sets the build command, publish directory and the
   rule that serves `index.html` for every path, so refreshes on nested routes work.
2. Add the environment variables above in Site settings > Environment variables.
3. In Supabase, Authentication > URL Configuration: set the Site URL to your Netlify address and add it to the redirect URLs.
4. In Supabase, Authentication: turn on leaked-password protection if your plan allows it.

## Known limits

- `place_order` has no rate limiting or bot protection yet. Anyone can place orders, and each order reserves stock. Before a store gets real traffic, add a CAPTCHA or an edge function in front of checkout.
- Catalog screens load a store's products in one request; the API returns at most 1,000 rows per request, so very large catalogs need pagination.
- Customers don't get a confirmation email yet, and clients aren't notified of new orders; they see them in the Orders screen (use Refresh).
- Customers can't look an order up later except through its confirmation link.

## Manual steps that remain

- Fill in the optional contact variables so the homepage contact section has real details.
- Each client turns on GCash or bank transfer and enters their payment details in Dashboard > Store settings. Until they do, only cash on delivery is available.
- Password reset is not built yet. For now, reset a client's password from the Supabase dashboard.
- Sending invitation emails automatically needs a server-side function with the service-role key. Today an invitation is claimed at the person's first sign-in.
