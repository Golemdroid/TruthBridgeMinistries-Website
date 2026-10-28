# TruthBridge Ministries — truthbridgeministries.org

Website where anyone in Canada can request a free Bible by mail.

- **Public site** — homepage with request form, FAQ, privacy policy
- **Admin page** (`/admin`) — volunteers see requests, mark them packed/shipped, download a CSV for mailing labels
- **Hosting** — Cloudflare Pages (free), with Pages Functions for the form and a Cloudflare D1 database for requests

```
public/             the website (HTML, CSS, JS, images)
  index.html        homepage + request form
  privacy.html      privacy policy
  admin/            volunteer dashboard
functions/api/      server code (runs on Cloudflare)
  request.js        saves a Bible request
  config.js         public settings for the page
  admin/            password-protected admin API
schema.sql          database table definition
```

---

## One-time setup (about 20 minutes)

### 1. Create the database
1. Cloudflare dashboard → **Storage & Databases → D1 SQL Database → Create**.
2. Name it `truthbridge-requests`.
3. Open it → **Console**, paste the contents of `schema.sql`, click **Execute**.

### 2. Create the Pages project from GitHub
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick this GitHub repository.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `public`
4. Click **Save and Deploy**.

### 3. Connect the database and set the admin password
In the Pages project → **Settings**:
1. **Bindings → Add → D1 database**: variable name `DB`, database `truthbridge-requests`.
2. **Variables and Secrets → Add** (type **Secret**):
   - `ADMIN_TOKEN` — the volunteer password for `/admin` (use a long one, 16+ characters)
   - `IP_SALT` — any random text (used to anonymise IP addresses for rate limiting)
   - `MONTHLY_LIMIT` (plain variable, optional) — how many Bibles you can send per month. Defaults to `20`; set `0` to pause requests. When the month is full, the form is replaced by a "requests full" notice until the 1st of next month. Cancelled requests don't count, so cancelling a duplicate frees up a slot.
3. Go to **Deployments** and **Retry deployment** on the latest one so the settings take effect.

### 4. Point your domain at the site
Pages project → **Custom domains → Set up a custom domain** → `truthbridgeministries.org`, then add `www.truthbridgeministries.org` too. Because the domain is already on Cloudflare, DNS is set up automatically.

### 5. (Recommended) Spam protection with Turnstile
1. Cloudflare dashboard → **Turnstile → Add widget**, hostname `truthbridgeministries.org`, mode **Managed**.
2. In the Pages project add:
   - `TURNSTILE_SITE_KEY` (plain variable) — the site key
   - `TURNSTILE_SECRET` (secret) — the secret key
3. Redeploy. The check appears on the form automatically.

### 6. (Recommended) Extra lock on the admin page with Cloudflare Access
**Zero Trust → Access → Applications → Add → Self-hosted**, domain `truthbridgeministries.org`, path `admin*` — then add a second path `api/admin*`. Policy: **Allow** → emails of your volunteers. They'll get a one-time code by email before the admin page even loads. Free for up to 50 users.

---

## Day-to-day use
1. Go to `https://truthbridgeministries.org/admin` and sign in with the `ADMIN_TOKEN` password.
2. The **New** tab shows requests waiting to be sent. The site refuses a second request from the same email, or the same name at the same address. A different person at an address that already requested in the last 12 months is accepted but flagged in red.
3. **Download CSV** to print labels (works with Avery mail-merge or Canada Post's bulk upload).
4. Tick the requests you've mailed → **Mark selected shipped**.

## Making changes
Edit files on GitHub (or locally and push). Every push to `main` redeploys the site automatically within a minute. Pull requests get their own preview link.

To change the contact email, search for `contact@truthbridgeministries.org` in `public/`.

## Running locally (optional)
```bash
npm install -g wrangler
cp wrangler.toml.example wrangler.toml
echo "ADMIN_TOKEN=local-test-password-123" > .dev.vars
wrangler d1 execute truthbridge-requests --local --file=schema.sql
wrangler pages dev
```
