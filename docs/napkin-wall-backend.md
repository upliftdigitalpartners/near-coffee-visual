# Turning the napkin wall on

The wall is finished apart from one thing: somewhere to keep the notes.

Right now it runs on `LocalStore`, which keeps notes in the visitor's own
browser. Everything behaves correctly — writing, the 90-character limit, the
fade, the seven-day expiry — but **nobody sees anybody else's notes**, and the
UI says so out loud ("only you can see these"). That is deliberate. A wall that
looks shared and isn't would be a lie told to every visitor.

Switching it on is two environment variables. No code changes.

## What the client expects

```
GET  {VITE_WALL_ENDPOINT}          -> [{ id, text, at }]     at = epoch ms
POST {VITE_WALL_ENDPOINT} {text}   -> { id, text, at }
```

`VITE_WALL_KEY`, if set, is sent as both `apikey` and `Bearer`.

## Supabase (least work from a static site)

Create a project, then run this in the SQL editor:

```sql
create table napkins (
  id   uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 90),
  at   bigint not null default (extract(epoch from now()) * 1000)::bigint
);

alter table napkins enable row level security;

-- Anyone may read notes that have not expired.
create policy "read living notes" on napkins for select
  using (at > (extract(epoch from now()) * 1000)::bigint - 7 * 24 * 60 * 60 * 1000);

-- Anyone may pin one, but only with a sane body.
create policy "pin a note" on napkins for insert
  with check (char_length(text) between 1 and 90);

-- Nobody may edit or delete through the anon key. You delete from the
-- dashboard, or with the service role key, and never from the browser.
```

Then, at build time:

```
VITE_WALL_ENDPOINT=https://<project>.supabase.co/rest/v1/napkins?select=id,text,at&order=at.desc&limit=100
VITE_WALL_KEY=<the anon public key>
```

The anon key is meant to be public — it is safe in client code *because* RLS is
on. It is not safe without RLS. Do not put the service role key anywhere near
this build.

Sweep expired rows on a schedule so the table does not grow forever:

```sql
delete from napkins
where at < (extract(epoch from now()) * 1000)::bigint - 7 * 24 * 60 * 60 * 1000;
```

## Before you point this at nearcoffee.space

This is a text box on the open internet, publishing to a page that carries your
name. Please read this part.

- **The client-side checks are not moderation.** `clean()` strips control
  characters and caps length; the one-a-minute throttle is `localStorage` and
  falls to anyone who opens a private window. Both are speed bumps.
- **You need a delete key from day one.** The Supabase dashboard is enough to
  start: sort by `at`, delete the row. Know how to do it *before* you need to.
- **Consider holding notes for review** if this is ever linked anywhere busy.
  A `visible boolean default false` column and a policy change is a small edit
  and turns the wall from open-publishing into a queue.
- **Seven days is a feature, not just a rule.** Anything bad has a fixed
  lifetime, which is a genuine safety property, not only a nice idea.
- Rate limiting per IP needs an edge function or a Postgres trigger keyed on
  `request.headers`. Worth doing before the wall is linked publicly.

---

# Turning presence on

Same shape as the wall. It ships on `LocalPresence`, which uses
`BroadcastChannel` — that is *real* presence, genuinely other windows, but only
ever your own browser. Open a second tab and a second silhouette appears
because there really is one. The interface says "this browser only".

It deliberately does **not** invent people. A room populated with fictional
visitors would be a lie told to everyone who sat in it.

## What the client expects

```
POST {VITE_PRESENCE_ENDPOINT}  { id, seen }   -> anything; records a heartbeat
GET  {VITE_PRESENCE_ENDPOINT}                 -> [{ id, seen }]   seen = epoch ms
```

Heartbeat every 10s; a visitor is gone after 32s of silence.

## Supabase

```sql
create table presence (
  id   text primary key,
  seen bigint not null
);

alter table presence enable row level security;

-- Anyone may see who is here in the last half-minute.
create policy "read the room" on presence for select
  using (seen > (extract(epoch from now()) * 1000)::bigint - 32000);

-- Anyone may say they are here, and update their own row.
create policy "check in"  on presence for insert with check (char_length(id) < 40);
create policy "still here" on presence for update using (true) with check (true);
```

```
VITE_PRESENCE_ENDPOINT=https://<project>.supabase.co/rest/v1/presence?select=id,seen
```

Reuses `VITE_WALL_KEY`. The `Prefer: resolution=merge-duplicates` header the
client already sends makes the POST an upsert on the primary key.

Sweep the table on a schedule, as with napkins.

## On privacy

Nothing identifying is stored or transmitted. The id is random, lives in
`sessionStorage`, dies with the tab, and exists only to keep one visitor in the
same chair while they are here. There are no names, no accounts and no way for
one visitor to learn anything about another — which is not an oversight, it is
the feature. If you ever add anything to this table, remember that a silhouette
you can identify is just a person you are surveilling.

---

# Today's bake

One line on the chalkboard by the door. Unlike the napkin wall, this one is
**yours** — the browser may read it and nothing else. You change it from the
Supabase table editor, which takes about fifteen seconds from a phone.

```sql
create table bake (
  id         int primary key default 1,
  text       text not null default '',
  updated_at timestamptz not null default now(),
  constraint one_row check (id = 1)
);

alter table bake enable row level security;
grant select on bake to anon;

-- Read only. There is deliberately no insert or update policy for anon, so
-- nobody can chalk on your board through the public key.
create policy "read the board" on bake for select using (true);

insert into bake (id, text) values (1, 'cardamom buns. three left.');
```

Then set, alongside the other variables:

```
VITE_BAKE_ENDPOINT=https://<project>.supabase.co/rest/v1/bake?select=text,updated_at&limit=1
```

It reuses `VITE_WALL_KEY`.

## Changing it each morning

Supabase → Table Editor → `bake` → edit the `text` cell → Enter. The café picks
it up within fifteen minutes, or immediately on a reload.

Leave it empty and the slate reads "wiped clean", which is a true thing to show
for a kitchen nobody is standing in. That is better than a stale line claiming
there are buns.
