# Priti's birthday site

One self-contained page, 11 chapters. Her reply comes back to you.

## Run it locally

```bash
node dev-server.js
```

http://localhost:5173 — `.env` is re-read on every request, so edit and refresh.

## Configure

```bash
cp .env.example .env
```

`.env` is gitignored. Everything you'd want to change lives there:
her name, the birth date every number derives from, and where her
reply goes.

## Ship it

```bash
node build.js          # writes dist/index.html with .env baked in
```

Then deploy `dist/` — Cloudflare Pages, Netlify, Vercel, anything static.

```bash
npx wrangler pages deploy dist
```

## Getting her reply — pick one

### A. Proxy (use this if you host it publicly)

Your bot token lives on a Cloudflare Worker, never in the page.

```bash
npm i -g wrangler && wrangler login
wrangler deploy worker/telegram-proxy.js --name birthday-proxy
wrangler secret put TELEGRAM_TOKEN
wrangler secret put CHAT_ID
wrangler secret put ALLOWED_ORIGIN     # your site URL, locks the proxy to it
```

Put the Worker URL in `.env` as `TELEGRAM_PROXY_URL`, rebuild. Done —
nothing secret is in the page, and her voice/video note still arrives.

### B. Direct (fine for localhost or a private one-off link)

`TELEGRAM_TOKEN` + `TELEGRAM_CHAT_ID` in `.env`.

> **This bakes the token into the built HTML in plain text.** Anyone who
> views source on the hosted page can read it. Use a throwaway bot and
> `/revoke` it in BotFather once you have her reply.

- token — message `@BotFather`, send `/newbot`
- chat id — message your bot once, then open
  `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy
  `result[0].message.chat.id`

### C. No setup

Leave Telegram blank. She gets WhatsApp / the share sheet / clipboard
and presses send herself. Set `WHATSAPP` in `.env` to pre-fill the chat.

## What reaches you

Her written note, her wish (always included), and any voice or video
note she records. Recordings only travel with options A and B — the
manual fallbacks can't carry a file, so she saves it and attaches it.

## Files

| | |
|---|---|
| `birthday.html` | the whole site — HTML, CSS, JS |
| `.env` | your values (gitignored) |
| `dev-server.js` | local server, injects `.env` per request |
| `build.js` | bakes `.env` into `dist/index.html` |
| `env-config.js` | shared `.env` parser |
| `worker/telegram-proxy.js` | Cloudflare Worker that hides the token |
