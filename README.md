# The Seat Studio

A lightweight browser tool for managing seating charts that change frequently.

## Features
- Set table counts separately for Main Room and Overflow Room.
- Per table: name, guest count (6-12), and notes.
- Edit table name and guest count directly inside the Room Layout panel.
- Drag tables around a room layout to match your floor plan.
- Dedicated Overflow Room Layout with the same drag/edit behavior as main room.
- Quick-jump controls at the top to move between key sections.
- Main Room includes stage + left/right TV markers.
- Overflow Room includes a large display + left/right doors to main room.
- Venue Night Mode visual theme.
- Breadcrumb snapshots with restore + per-snapshot JSON download.
- Export current plan to JSON for documentation.
- Auto-saves in browser local storage.
- Shared live collaboration by room link (`?room=...`) with no collaborator sign-in.

## Run
Open `index.html` directly in a browser.

If your browser blocks local module behavior, run a static server:

```bash
cd "/Users/morgan/Documents/New project"
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy To Vercel (Recommended)
1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), click `Add New...` -> `Project`.
3. Import your repo.
4. Framework preset: `Other`.
5. Root directory: project root (`/Users/morgan/Documents/New project` content).
6. Click `Deploy`.
7. After deploy, share links like:
   - `https://your-vercel-domain.vercel.app/?room=gala-2026`

Notes:
- You do not need to keep Terminal running after deploy.
- Collaborators should always use the full link with the same `?room=...` value.

## Shared Collaboration Setup (No Collaborator Accounts)
1. Create a Supabase project (only organizer needs this account).
2. In Supabase SQL editor, run:

```sql
create table if not exists public.seat_studio_rooms (
  code text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.seat_studio_versions (
  id bigint generated always as identity primary key,
  room_code text not null,
  label text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.seat_studio_rooms enable row level security;
alter table public.seat_studio_versions enable row level security;

create policy "public read rooms"
on public.seat_studio_rooms
for select
to anon
using (true);

create policy "public write rooms"
on public.seat_studio_rooms
for insert
to anon
with check (true);

create policy "public update rooms"
on public.seat_studio_rooms
for update
to anon
using (true)
with check (true);

create policy "public read versions"
on public.seat_studio_versions
for select
to anon
using (true);

create policy "public write versions"
on public.seat_studio_versions
for insert
to anon
with check (true);
```

3. Add your project values to `/Users/morgan/Documents/New project/app.js`:
   - `SHARED_CONFIG.supabaseUrl`
   - `SHARED_CONFIG.supabaseAnonKey`
4. Open the app with a room link, for example:
   - `http://localhost:8000/?room=gala-2026`
5. Share that exact link with collaborators.

Anyone on the same `?room=...` link edits in real time together, and snapshots are shared as version history for that room.
