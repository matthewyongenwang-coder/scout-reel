# Turning on accounts and private scouting

Scout Reel ships with accounts switched off. Browsing events, teams and match videos works without them. This guide switches on sign in, team workspaces and scouting cards.

Most of the setup is one script. You only do the parts that need your own logins and passwords.

## Already done for you

- Database tables, security rules and tests: `supabase/migrations/`.
- All Supabase sign-in settings, written down in `supabase/config.toml`: site address, allowed redirect addresses (the live site, localhost 3009 and 3010), exposed API schemas, email limit of 30 an hour, email sender, and both sign-in email templates (`supabase/templates/sign-in.html`).
- `NEXT_PUBLIC_SITE_URL` is set in Vercel (Production `https://scout-reel-five.vercel.app`, Development `http://localhost:3009`).
- The setup script: `scripts/setup-accounts.sh`.

## What you need before starting (about 20 minutes)

1. Your Supabase login (the account that owns the Scout Reel project).
2. The Scout Reel database password. If you do not have it:
   1. Open https://supabase.com/dashboard and click the Scout Reel project.
   2. In the left sidebar, click **Project Settings** (gear icon), then **Database**.
   3. Under **Database password**, click **Reset database password**, click **Generate a password**, copy it into your password manager, and click **Reset password**.
3. An email sender. Supabase's built-in email only reaches you, 2 emails an hour, so teammates cannot sign in without one. Pick A or B.

### A. Resend (recommended, needs a domain you own)

1. Go to https://resend.com and click **Sign up**. Create the account with your own details.
2. In the left menu, click **Domains**, then **Add Domain**.
3. Type your domain (for example `ctrlz96z.com`), choose the region closest to you, and click **Add**.
4. Resend shows several DNS records (MX, TXT for SPF, TXT for DKIM). Open your domain provider (for example Namecheap, Cloudflare, Porkbun) in another tab, go to its DNS settings, and add each record exactly as shown.
5. Back in Resend, click **Verify DNS Records**. It can take a few minutes to an hour. Wait until the domain says **Verified**.
6. In the left menu, click **API Keys**, then **Create API Key**. Name it `scout-reel-supabase`, set **Permission** to **Sending access**, set **Domain** to your domain, and click **Add**.
7. Copy the key straight into your password manager. Do not paste it into chat, code or notes.
8. You will type these into the script:
   - `SMTP_HOST`: `smtp.resend.com`
   - `SMTP_USER`: `resend`
   - `SMTP_PASSWORD`: the API key
   - `SMTP_SENDER_EMAIL`: an address on your domain, for example `signin@ctrlz96z.com`

### B. Gmail (no domain, small team only)

1. Create a new Gmail account just for this (for example `scoutreel.96z@gmail.com`). Do not use your personal account.
2. Signed in to that account, open https://myaccount.google.com/security.
3. Under **How you sign in to Google**, click **2-Step Verification** and turn it on.
4. Open https://myaccount.google.com/apppasswords, type the name `Scout Reel Supabase`, and click **Create**.
5. Copy the 16-letter app password into your password manager.
6. You will type these into the script:
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_USER`: the Gmail address
   - `SMTP_PASSWORD`: the app password (no spaces)
   - `SMTP_SENDER_EMAIL`: the same Gmail address

Gmail allows about 500 emails a day, which is plenty for a team.

## Run the setup script

1. In the Claude app, open the **Terminal** panel (or open Terminal on your Mac).
2. Go to the repo and run the script:

   ```bash
   cd ~/scout-reel && bash scripts/setup-accounts.sh
   ```

3. Follow what it prints. Each step waits for you where it matters.
   1. **Sign in to Supabase.** A browser window opens. Sign in and click **Authorize**. Then come back to the terminal.
   2. **Link.** Type the database password when asked. Nothing shows while you type; that is normal. Press Enter.
   3. **Create the tables.** It lists `20260914120000_accounts_and_scouting.sql`. Press Enter to apply it. It should end without errors.
   4. **Account deletion check.** It prints `can_delete_accounts` with `true` or `false`. Note which one.
   5. **Email sender.** Type the four values from option A or B. The password stays hidden while you type.
   6. **Push the sign-in settings.** It prints the changes. They should only be the site URL, redirect URLs, API schemas, email limit, SMTP settings and the two email templates. Press Enter. It may ask to confirm each group; answer `y`.
   7. **Outside check.** Every line should say `PASS`.
4. When it says **Done**, tell Claude: "setup script finished, can_delete_accounts was true" (or false).

If a step fails, copy the error line (never passwords or keys) and tell Claude.

## What Claude does after you say it finished

1. Adds `ACCOUNTS_ENABLED=true` to Vercel (Production and Development) and redeploys.
2. Checks the live site shows **Scouting** and **Account**.
3. Asks you to sign in once and create the 96Z workspace, then runs the two-account check that neither workspace can see the other's cards.

## Your first sign in

1. Open https://scout-reel-five.vercel.app and click **Account**, then **Sign in**.
2. Type your email, tick **I am 13 or older**, and click **Email me a sign-in link**.
3. Open the email. Either click **Sign in to Scout Reel** and then **Continue**, or type the code on the sign-in page.
4. On the Account page, under **Create a workspace**, type `Ctrl Z scouting` and team number `96Z`, then click **Create workspace**.
5. Copy the invite code it shows (it is only shown once) and send it to teammates. They sign in, go to **Account**, paste it under **Join a workspace**, and click **Join workspace**.

## Manual fallback (only if the script cannot run)

Do these in the Supabase dashboard instead of steps 1 to 6 of the script.

1. **Tables:** left sidebar **SQL Editor**, **New query**, paste all of `supabase/migrations/20260914120000_accounts_and_scouting.sql`, click **Run**. Then a new query with `select has_table_privilege('auth.users', 'delete') as can_delete_accounts;` and **Run**.
2. **API schemas:** **Project Settings**, **Data API**. Under **Exposed schemas** keep only `public` and `graphql_public`. Never add `private`.
3. **Addresses:** **Authentication**, **URL Configuration**. **Site URL** `https://scout-reel-five.vercel.app`, **Save**. Under **Redirect URLs**, **Add URL** for each of `https://scout-reel-five.vercel.app/**`, `http://localhost:3009/**`, `http://localhost:3010/**`, then **Save**.
4. **Emails:** **Authentication**, **Emails**, **Templates** tab. Open **Magic link or OTP**, subject `Sign in to Scout Reel`, paste the contents of `supabase/templates/sign-in.html` as the body, **Save**. Open **Confirm sign up**, subject `Finish signing up for Scout Reel`, same body, **Save**.
5. **Sender:** **Authentication**, **Emails**, **SMTP Settings** tab. Turn on **Enable custom SMTP**. Fill **Sender email**, **Sender name** `Scout Reel`, **Host**, **Port number** `465`, **Username**, **Password** from option A or B. **Save**.
6. **Email limit:** **Authentication**, **Rate Limits**. **Rate limit for sending emails** `30`, **Save**.
7. **Outside check:** in the terminal, `cd ~/scout-reel && node scripts/check-rls-live.mjs`. Every line should say `PASS`.

## Running accounts on your own computer

Add these lines to `~/scout-reel/.env.local` (never committed), then restart `npm run dev`:

```
ACCOUNTS_ENABLED=true
NEXT_PUBLIC_SITE_URL=http://localhost:3009
```
