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
