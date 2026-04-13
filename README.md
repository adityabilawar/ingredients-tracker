# PantryOS

Production-oriented Next.js app for tracking **ingredients** and **supplements** (with images via Pexels → DALL-E fallback), **recipes** (Spoonacular with OpenAI fallback + embedded YouTube), and a **weekly meal plan**. Auth via **Supabase OAuth** (Google, GitHub, Apple).

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Postgres, Auth, Storage)
- Tailwind CSS v4 + shadcn/ui
- Deployed on **Vercel**

## Setup

1. **Clone & install**

   ```bash
   npm install
   ```

2. **Supabase**

   - Create a project at [supabase.com](https://supabase.com).
   - Run the SQL in [`supabase/migrations/20250413000000_initial.sql`](supabase/migrations/20250413000000_initial.sql) in the SQL editor (or use Supabase CLI migrations).
   - **Auth → Providers**: enable **Google**, **GitHub**, and **Apple**; add OAuth client IDs/secrets per provider docs.
   - **Auth → URL configuration**
     - Site URL: your production URL (e.g. `https://your-app.vercel.app`).
     - Redirect URLs: `http://localhost:3000/auth/callback` and `https://your-app.vercel.app/auth/callback`.

3. **Environment**

   Copy [`.env.example`](.env.example) to `.env.local` and fill values.

4. **Run**

   ```bash
   npm run dev
   ```

5. **Vercel**

   - Import the repo, set the same env vars in the project settings.
   - Add `NEXT_PUBLIC_APP_URL` to your production domain.

## API keys (optional features)

| Variable                 | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `PEXELS_API_KEY`         | Stock photos for ingredients/supplements   |
| `OPENAI_API_KEY`         | DALL-E fallback + recipe suggestion fallback |
| `SUPABASE_SERVICE_ROLE_KEY` | Upload DALL-E images to Storage (server only) |
| `SPOONACULAR_API_KEY`    | Recipe search & “find by ingredients”      |
| `YOUTUBE_API_KEY`        | Pick a similar cooking video per recipe      |

Without optional keys, the app still runs: placeholders for images, empty recipe suggestions until Spoonacular is set, etc.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — ESLint

## Security notes

- All tables use **Row Level Security**; users only see their own data.
- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the client; it is only used server-side for storage uploads.
- API routes are protected by session middleware; anonymous `/api` calls receive `401`.
