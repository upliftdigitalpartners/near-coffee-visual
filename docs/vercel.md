# Moving the café to Vercel

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

## Done already

- Project **nearcoffee/near-coffee-room** created under the `nearcoffee` team.
- Production deployed from the CLI, build status Ready.
- `room.nearcoffee.space` attached to the project.
- Deployment protection checked: `all_except_custom_domains`. The `.vercel.app`
  URLs sit behind Vercel SSO, the custom domain does **not**, so the café will
  be public the moment DNS resolves. Nothing to change.

Redeploy any time with:

```bash
npm run deploy:vercel
```

## 1. The DNS record (yours — I cannot touch Squarespace)

In Squarespace DNS settings, add exactly what Vercel asked for:

| Type | Host | Value |
| --- | --- | --- |
| A | `room` | `76.76.21.21` |

Note this is an **A record**, not the CNAME that is usually quoted for
subdomains. That is what `vercel domains inspect` returned for this domain, so
use it. Certificates issue automatically a few minutes after it resolves.

Check with:

```bash
dig +short room.nearcoffee.space
vercel domains inspect room.nearcoffee.space --scope nearcoffee
```

## 2. Deploys on push — optional, and currently blocked

`vercel git connect` fails for `upliftdigitalpartners/near-coffee-visual`. The
Vercel GitHub App has not been installed on that organisation, and installing it
needs an org owner. Your account can push to the repo but does not show up as a
member of the org, so you may not be able to authorise it yourself.

Three ways out, in the order I would try them:

1. **Do nothing.** `npm run deploy:vercel` works today and is one command.
2. **Move the repo to `fahimalamwork`**, where the site repo already lives and
   you clearly have full control. Then `vercel git connect` will just work.
3. **Ask an owner of `upliftdigitalpartners`** to install the Vercel GitHub App
   and grant it access to that one repository.

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
