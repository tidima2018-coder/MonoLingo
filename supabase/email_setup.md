# MonoLingo email confirmation and SMTP

## Why registration gets HTTP 429

Supabase's built-in email sender is intended for testing. Hosted projects currently have a project-wide limit of 2 Auth emails per hour, and the built-in sender only delivers to addresses on the Supabase organization's team. When the email quota is exceeded, Auth returns HTTP 429 with `over_email_send_rate_limit` / `email rate limit exceeded`. The site now shows a resend button and enforces a 60-second cooldown across tabs in the same browser; it does not retry requests automatically or bypass Supabase's limits.

## Confirm signup template

1. Publish `confirm.html`, `js/confirm.js`, and the updated `js/supabaseClient.js` to the site. The production page is `https://monolingo.sitevo.kz/confirm.html`.
2. In Supabase Dashboard, open **Authentication → URL Configuration**. Set **Site URL** to `https://monolingo.sitevo.kz` and add `https://monolingo.sitevo.kz/confirm.html` to **Redirect URLs**.
3. Open **Authentication → Sign In / Providers → Email** and make sure **Confirm email** is enabled. With it enabled, Supabase requires confirmation before password sign-in. Keep it enabled in production.
4. Open **Authentication → Email Templates → Confirm signup**. Set the subject to `Verify Your Email – MonoLingo` and replace the message body with the full contents of `supabase/email_templates/confirmation.html`.

The email points directly to `confirm.html` with `token_hash` and `type=email`. Loading that page does not confirm the account. The page calls `verifyOtp` only after the user presses **Подтвердить почту**. If the link has expired or is invalid, the page lets the user request another confirmation email by entering the email address.

## Set the actual sender name with free SMTP

Changing the subject or HTML template does not change the sender shown in the inbox. Supabase's default mail service is limited and is intended for testing; configure custom SMTP for public signup. Supabase documents a custom SMTP sender name and From address as separate SMTP settings.

1. Create a free Brevo account. Its current Free plan includes transactional email and 300 sends per day; limits and plan features can change. No paid plan is required for this setup.
2. In Brevo, open **Settings → Senders, Domains, IPs → Domains**, add the sending domain you control (for example, `monolingo.sitevo.kz`), and choose **Authenticate**.
3. Add the DNS records Brevo displays (domain ownership code, DKIM, and DMARC) at the DNS provider for that domain. Use the exact values from your Brevo account. Do not remove or overwrite existing DNS records without checking their effect. Wait until Brevo reports the domain as authenticated.
4. In Brevo, create a sender such as `no-reply@monolingo.sitevo.kz` under **Senders**. Use a sender on the authenticated domain.
5. In **Settings → SMTP & API → SMTP**, create an **SMTP key**. Copy the SMTP login shown there; it can differ from your Brevo dashboard email. Use the SMTP key, not a Brevo API key.
6. In Supabase Dashboard, open **Authentication → SMTP Settings** (custom SMTP) and configure:
   - Sender email: the verified sender, such as `no-reply@monolingo.sitevo.kz`
   - Sender name: `MonoLingo`
   - Host: `smtp-relay.brevo.com`
   - Port: `587` with TLS/STARTTLS
   - Username: the SMTP login shown in Brevo
   - Password: the Brevo SMTP key
7. Save and send a test signup email. Check that the inbox shows **MonoLingo** as the sender, the email arrives, and the link opens the deployed confirmation page.
8. Open **Authentication → Rate Limits**. Keep the combined Auth email limit within the Brevo Free quota (currently 300 sends/day across transactional and campaign email). Start conservatively, leave headroom for password resets and other Auth messages, and do not turn off email confirmation to remove the limit.

With custom SMTP, Supabase currently starts with a conservative Auth email limit of 30 per hour; it can be adjusted in Rate Limits. Brevo Free includes transactional mail and 300 daily sends, so account for all email types and avoid setting the Supabase limit above the provider's available quota. [Supabase documents the built-in and custom SMTP rate limits here](https://supabase.com/docs/guides/auth/rate-limits).

Keep SMTP credentials only in the Supabase dashboard. Do not put them in this repository, browser JavaScript, or GitHub Pages. The static site only needs the public Supabase URL and publishable key.

Reference docs: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Brevo SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), [Brevo domain authentication](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC), [Brevo Free plan](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans).
