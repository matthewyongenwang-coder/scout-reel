# Turning on accounts and private scouting

Scout Reel ships with accounts switched off. Browsing events, teams and match videos works without them. Follow these steps once to switch on sign in, team workspaces and scouting cards. Do them in order.

You need: the Supabase project the app already uses, the Vercel project `scout-reel`, and a way to send email (step 5).

## 1. Create the database tables

1. Open https://supabase.com/dashboard and pick the Scout Reel project.
2. In the left sidebar, click **SQL Editor**.
3. Click **New query**.
4. Open `supabase/migrations/20260914120000_accounts_and_scouting.sql` from the repo, copy all of it, and paste it into the editor.
5. Click **Run**. It should finish with "Success. No rows returned".
6. Click **New query** again, paste the line below, and click **Run**:

   ```sql
   select has_table_privilege('auth.users', 'delete') as can_delete_accounts;
   ```

   If it shows `true`, account deletion will work. If it shows `false`, the app still works, but the Delete my account button will say deletion is not available yet. Tell Claude so it can switch to a different approach.

## 2. Keep the private helpers private

1. In the left sidebar, click **Project Settings**, then **Data API**.
2. Under **Exposed schemas**, check that only `public` (and `graphql_public`, if listed) are there.
3. Never add `private` to that list. It holds the membership checks the security rules use.

## 3. Allow the sign-in links to come back to the app

1. In the left sidebar, click **Authentication**, then **URL Configuration**.
2. Set **Site URL** to `https://scout-reel-five.vercel.app` and click **Save**.
3. Under **Redirect URLs**, click **Add URL** and add each of these, one at a time:
   - `https://scout-reel-five.vercel.app/**`
   - `http://localhost:3009/**`
   - `http://localhost:3010/**`
4. Click **Save**.

## 4. Change the two sign-in emails

The default emails use a link that school email scanners can use up before the student clicks it. These versions send the student to a Continue page instead, and include a code they can type on another device.

1. In the left sidebar, click **Authentication**, then **Emails** (it may be under **Notifications**, then **Email**).
2. Open the **Templates** tab.
3. Click **Magic link or OTP**. Set **Subject** to `Sign in to Scout Reel`. Replace the whole **Message body** with the text below, then click **Save**.
4. Click **Confirm sign up**. Set **Subject** to `Finish signing up for Scout Reel`. Replace the whole **Message body** with the same text below, then click **Save**.

```html
<h2>Sign in to Scout Reel</h2>
<p>Press this link to sign in:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in to Scout Reel</a></p>
<p>Or type this code on the sign-in page: <strong>{{ .Token }}</strong></p>
<p>The link and code stop working after a short time. If you did not ask to sign in, you can ignore this email.</p>
```

## 5. Send email to anyone, not just you

Supabase's built-in email only sends to members of your Supabase team, at 2 emails an hour. Teammates cannot sign in until you connect your own email sender.

### Option A (recommended): Resend with your own domain

Resend needs a domain you own, for example a cheap one for the team.

1. Go to https://resend.com and create an account.
2. Click **Domains**, then **Add Domain**, type your domain, and follow the steps to add the DNS records it shows at your domain provider. Wait until the domain shows **Verified**.
3. Click **API Keys**, then **Create API Key**. Give it a name like `scout-reel-supabase`, choose **Sending access**, and click **Add**. Copy the key. Do not paste it into chat, code or notes.
4. Back in Supabase, click **Authentication**, then **Emails**, then the **SMTP Settings** tab.
5. Turn on **Enable custom SMTP** and fill in:
   - **Sender email**: an address on your domain, for example `signin@yourdomain.com`
   - **Sender name**: `Scout Reel`
   - **Host**: `smtp.resend.com`
   - **Port number**: `465`
   - **Username**: `resend`
   - **Password**: the API key you copied
6. Click **Save**.

### Option B: a Gmail account, for a small team only

1. Use a Gmail account made for this, not a personal one. Turn on 2-Step Verification for it.
2. In that Google account, create an **App password** and copy it.
3. In Supabase **SMTP Settings**, turn on **Enable custom SMTP** and fill in: **Sender email** the Gmail address, **Sender name** `Scout Reel`, **Host** `smtp.gmail.com`, **Port number** `465`, **Username** the Gmail address, **Password** the app password. Click **Save**.

## 6. Set a sensible email limit

1. In the left sidebar, click **Authentication**, then **Rate Limits**.
2. Set **Rate limit for sending emails** to `30` per hour (raise it later if your team needs more). Click **Save**.

Supabase also limits each email address to one sign-in email a minute.

## 7. Switch accounts on in Vercel

1. Open https://vercel.com, pick the team `matthew-wang-s-projects`, then the project `scout-reel`.
2. Click **Settings**, then **Environment Variables**.
3. Add `ACCOUNTS_ENABLED` with value `true`, ticking **Production** and **Development**. Click **Save**.
4. Add `NEXT_PUBLIC_SITE_URL` with value `https://scout-reel-five.vercel.app`, ticking **Production** only. Click **Save**.
5. Click **Deployments**, open the menu (three dots) on the latest production deployment, click **Redeploy**, and confirm. The new setting only applies after a redeploy.

## 8. Check it

1. In a terminal in the repo, run `node scripts/check-rls-live.mjs`. Every line should say PASS. It only uses the public anon key.
2. Open https://scout-reel-five.vercel.app. The header should now show **Scouting** and **Account**.
3. Click **Account**, then **Sign in**, and sign in with your email. Create a workspace for 96Z and copy the invite code it shows.
4. Open any team page from an event page and save a scouting card. It should appear on the **Scouting** page, and the team should show **Scouted** on the event page.
5. Tell Claude when this works, so it can run the full browser check with two real accounts (one in each of two workspaces) to confirm neither can see the other's cards.

## Running accounts locally

Add these two lines to `.env.local` (never committed), then restart `npm run dev`:

```
ACCOUNTS_ENABLED=true
NEXT_PUBLIC_SITE_URL=http://localhost:3009
```
