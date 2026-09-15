#!/usr/bin/env bash
# Guided setup for Scout Reel accounts. Run it yourself from the repo folder:
#
#   bash scripts/setup-accounts.sh
#
# It signs in to Supabase, applies the database migration, pushes the sign-in settings in
# supabase/config.toml, and checks that nothing is readable anonymously. Passwords and the
# email API key are typed into this terminal only. They are never saved or printed.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="bqfoibboleamfrhfjsar"
SB=(npx --yes supabase@2.117.0)

step() { printf '\n== %s\n' "$1"; }
confirm() { read -r -p "$1 Press Enter to continue, or Ctrl+C to stop. " _; }

step "1 of 7. Sign in to Supabase"
if "${SB[@]}" projects list >/dev/null 2>&1; then
  echo "Already signed in."
else
  echo "A browser window opens. Sign in to Supabase there and approve the CLI."
  "${SB[@]}" login
fi

step "2 of 7. Link this folder to the Scout Reel project"
echo "When asked for the database password: Supabase dashboard, Project Settings, Database."
echo "If you never saved it, click Reset database password there first."
"${SB[@]}" link --project-ref "$PROJECT_REF"

step "3 of 7. Create the tables and security rules"
"${SB[@]}" db push --linked --dry-run
confirm "The migration listed above will be applied to the real database."
"${SB[@]}" db push --linked

step "4 of 7. Check that accounts can be deleted"
"${SB[@]}" db query --linked "select has_table_privilege('auth.users', 'delete') as can_delete_accounts;"
echo "If this says false, everything else still works, but Delete my account will say it is not available yet. Tell Claude."

step "5 of 7. Email sender"
echo "Resend: host smtp.resend.com, user resend, password is your Resend API key, sender is an address on your verified domain."
echo "Gmail: host smtp.gmail.com, user is the Gmail address, password is its app password, sender is the same Gmail address."
ask() {
  local name=$1 hidden=${2:-}
  if [ -n "${!name:-}" ]; then return; fi
  local value
  if [ -n "$hidden" ]; then
    read -r -s -p "$name (hidden while you type): " value
    echo
  else
    read -r -p "$name: " value
  fi
  if [ -z "$value" ]; then echo "$name cannot be empty." >&2; exit 1; fi
  export "$name=$value"
}
ask SMTP_HOST
ask SMTP_USER
ask SMTP_PASSWORD hidden
ask SMTP_SENDER_EMAIL

step "6 of 7. Push the sign-in settings"
echo "These are the changes supabase/config.toml will make:"
"${SB[@]}" config diff --project-ref "$PROJECT_REF"
confirm "Check the changes above. Only site URL, redirect URLs, exposed schemas, email limit, email sender and the two email templates should change."
"${SB[@]}" config push --project-ref "$PROJECT_REF"

step "7 of 7. Check from the outside that nothing is readable anonymously"
node scripts/check-rls-live.mjs

step "Done"
echo "Tell Claude it finished. Claude then switches accounts on in Vercel, redeploys, and runs the signed-in checks."
