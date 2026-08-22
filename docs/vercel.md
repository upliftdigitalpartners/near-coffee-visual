# Moving the room to Vercel

Target: **room.nearcoffee.space** served by Vercel. The marketing homepage
stays on GitHub Pages exactly as it is — one CNAME, nothing on the live site
changes, and if any of this goes wrong the worst case is a subdomain that does
not resolve.

Vercel cannot serve one domain from two projects, which is the whole reason
this is a subdomain rather than `nearcoffee.space/room`. Keeping that path
would have meant moving the 3.36MB marketing `index.html` into this repo.

Repo: https://github.com/upliftdigitalpartners/near-coffee-visual
`vercel.json` is already committed — build command, output directory and cache
headers are set, so the import should need no configuration.

## 1. Connect the repo (yours to do — it needs a login)

Either the dashboard:

1. vercel.com/new
2. Import `upliftdigitalpartners/near-coffee-visual`
3. Deploy. Framework, build command and output directory come from
   `vercel.json`; do not override them.

Or the CLI, from this directory:

```bash
vercel login
vercel link
vercel --prod
```

You will get a `*.vercel.app` URL. **Open it and check the room works before
touching DNS.**

## 2. Add the subdomain

In the Vercel project: Settings → Domains → add `room.nearcoffee.space`.

Vercel will show you a DNS record to create. Then in Squarespace DNS settings
add exactly what it shows — normally:

| Type | Host | Value |
| --- | --- | --- |
| CNAME | `room` | `cname.vercel-dns.com` |

Use whatever Vercel displays rather than this table if the two disagree; the
target has changed before.

Certificates issue automatically once the record resolves. Give it a few
minutes.

## 3. Tell me, and I will switch the homepage links

The three links on nearcoffee.space currently point at `/room/`, which is the
GitHub Pages copy. They stay pointing there until the subdomain is confirmed
working — a link to a domain that does not resolve yet is worse than a link to
the old copy.

Once it is up, the homepage links move to `https://room.nearcoffee.space` and
the Pages copy at `/room/` becomes a redirect stub, so anything already shared
keeps working.

## 4. Optional: turn the wall and presence on

In Vercel: Settings → Environment Variables. See
[napkin-wall-backend.md](napkin-wall-backend.md) for the Supabase schema.

```
VITE_WALL_ENDPOINT     https://<project>.supabase.co/rest/v1/napkins?select=id,text,at&order=at.desc&limit=100
VITE_WALL_KEY          <supabase anon public key>
VITE_PRESENCE_ENDPOINT https://<project>.supabase.co/rest/v1/presence?select=id,seen
```

These are `VITE_`-prefixed, so they are **compiled into the client bundle and
are public**. That is correct for the Supabase anon key, which is designed to
be public and is protected by row-level security. It would be catastrophic for
a service role key. Never put one here.

Redeploy after adding them; Vite reads env at build time, not at run time.

## What this actually buys

GitHub Pages caps `Cache-Control` at `max-age=600` on everything, including
files with a content hash in the name, and gives you no way to change it. So a
visitor returning twice in an afternoon re-downloads the whole bundle both
times — measured on the live site, roughly 1.5MB each visit.

`vercel.json` sets `immutable, max-age=31536000` on `/assets/*`, which is safe
precisely because those filenames contain a content hash. Vercel also serves
Brotli, which Pages does not: asking Pages for `br` returns the file
*uncompressed*.

The bundle is ~1.23MB raw, ~340KB gzipped. Expect roughly 280KB over Brotli,
and nothing at all on a second visit.
