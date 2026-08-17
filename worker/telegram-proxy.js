/**
 * Cloudflare Worker — keeps your bot token OFF the page.
 *
 * The page POSTs her note (and any recording) here; this Worker adds the
 * token server-side and forwards it to Telegram. The browser never sees it.
 *
 * DEPLOY (about 5 minutes, free tier is plenty):
 *   npm i -g wrangler
 *   wrangler login
 *   wrangler deploy worker/telegram-proxy.js --name birthday-proxy
 *
 *   wrangler secret put TELEGRAM_TOKEN     # paste your BotFather token
 *   wrangler secret put CHAT_ID            # paste your chat id
 *
 *   # lock it to your own site once you know the URL:
 *   wrangler secret put ALLOWED_ORIGIN     # e.g. https://priti-birthday.pages.dev
 *
 * Then put the Worker URL in .env as TELEGRAM_PROXY_URL and rebuild.
 */

const MAX_UPLOAD = 20 * 1024 * 1024;   // Telegram's bot upload ceiling

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status, headers: { ...cors, 'Content-Type': 'application/json' }
      });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST')    return json({ ok: false, error: 'POST only' }, 405);

    if (!env.TELEGRAM_TOKEN || !env.CHAT_ID) {
      return json({ ok: false, error: 'worker is missing TELEGRAM_TOKEN / CHAT_ID' }, 500);
    }

    const API = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}`;

    try {
      const form = await request.formData();
      const text = String(form.get('text') || '').slice(0, 3800);
      const kind = String(form.get('kind') || '');
      const file = form.get('file');

      if (!text && !file) return json({ ok: false, error: 'nothing to send' }, 400);

      if (text) {
        const r = await fetch(`${API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: env.CHAT_ID, text })
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          return json({ ok: false, error: d.description || 'sendMessage failed' }, 502);
        }
      }

      if (file && typeof file !== 'string') {
        if (file.size > MAX_UPLOAD) {
          return json({ ok: false, error: 'recording is too large (20 MB max)' }, 413);
        }
        const name = file.name || `note.${kind === 'video' ? 'webm' : 'webm'}`;
        const push = (method, field) => {
          const fd = new FormData();
          fd.append('chat_id', env.CHAT_ID);
          fd.append(field, file, name);
          return fetch(`${API}/${method}`, { method: 'POST', body: fd });
        };

        let r = kind === 'video' ? await push('sendVideo', 'video')
                                 : await push('sendAudio', 'audio');
        if (!r.ok) r = await push('sendDocument', 'document');   // codec refused → plain file
        if (!r.ok) return json({ ok: false, error: 'the note sent, the recording did not' }, 502);
      }

      return json({ ok: true });
    } catch (err) {
      return json({ ok: false, error: String(err && err.message || err) }, 502);
    }
  }
};
