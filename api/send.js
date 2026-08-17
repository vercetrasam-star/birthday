/**
 * Vercel Edge Function — receives Priti's reply and forwards it to you.
 *
 * Everything sensitive (your email, any bot token) lives in Vercel's
 * environment variables and is read ONLY here, on the server. None of it
 * is ever sent to the browser, so "view source" on the live site shows
 * nothing about you.
 *
 * Set these in Vercel → Project → Settings → Environment Variables:
 *   FORMSUBMIT_EMAIL    your email            (recommended)
 *   TELEGRAM_TOKEN      bot token             (optional)
 *   TELEGRAM_CHAT_ID    your chat id          (optional)
 *
 * Any that are set get used; it succeeds if at least one delivers.
 */

export const config = { runtime: 'edge' };   // edge gives us formData() for the file

const MAX_UPLOAD = 18 * 1024 * 1024;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

export default async function handler(req){
  if(req.method === 'OPTIONS') return new Response(null, { status:204 });
  if(req.method !== 'POST')    return json({ ok:false, error:'POST only' }, 405);

  const TG_TOKEN = process.env.TELEGRAM_TOKEN;
  const TG_CHAT  = process.env.TELEGRAM_CHAT_ID;
  const MAIL     = process.env.FORMSUBMIT_EMAIL;

  if(!MAIL && !(TG_TOKEN && TG_CHAT)){
    return json({ ok:false, error:'no delivery channel configured on the server' }, 500);
  }

  let form;
  try{ form = await req.formData(); }
  catch{ return json({ ok:false, error:'could not read the form' }, 400); }

  const text = String(form.get('text') || '').slice(0, 3800);
  const note = String(form.get('note') || '');
  const wish = String(form.get('wish') || '');
  const kind = String(form.get('kind') || '');
  const file = form.get('file');
  const name = String(form.get('name') || 'She');

  if(!text && !file) return json({ ok:false, error:'nothing to send' }, 400);
  if(file && typeof file !== 'string' && file.size > MAX_UPLOAD){
    return json({ ok:false, error:'that recording is too big (18 MB max)' }, 413);
  }

  const delivered = [];
  const failed    = [];

  /* ── Telegram ── */
  if(TG_TOKEN && TG_CHAT){
    const API = `https://api.telegram.org/bot${TG_TOKEN}`;
    try{
      const r = await fetch(`${API}/sendMessage`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT, text })
      });
      if(!r.ok) throw new Error('sendMessage ' + r.status);

      if(file && typeof file !== 'string'){
        const fname = file.name || `note.${kind === 'video' ? 'mp4' : 'webm'}`;
        const push = (method, field) => {
          const fd = new FormData();
          fd.append('chat_id', TG_CHAT);
          fd.append(field, file, fname);
          return fetch(`${API}/${method}`, { method:'POST', body: fd });
        };
        let r2 = kind === 'video' ? await push('sendVideo','video')
                                  : await push('sendAudio','audio');
        if(!r2.ok) r2 = await push('sendDocument','document');   // codec refused
        if(!r2.ok) throw new Error('file upload failed');
      }
      delivered.push('telegram');
    }catch(err){ failed.push('telegram: ' + (err.message || err)); }
  }

  /* ── FormSubmit (email) ── */
  if(MAIL){
    try{
      const fd = new FormData();
      fd.append('_subject', `🌷 ${name} replied from the birthday site`);
      fd.append('name', name);
      fd.append('note', note || '(no written note)');
      fd.append('wish', wish || '(no wish)');
      fd.append('message', text);
      fd.append('_captcha', 'false');
      fd.append('_template', 'box');
      if(file && typeof file !== 'string'){
        fd.append('attachment', file, file.name || 'note.webm');
      }
      const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(MAIL)}`,
                            { method:'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      const ok = j.success === true || String(j.success) === 'true';
      if(!ok) throw new Error(j.message || 'formsubmit refused');
      delivered.push('email');
    }catch(err){ failed.push('email: ' + (err.message || err)); }
  }

  return delivered.length
    ? json({ ok:true, via: delivered })
    : json({ ok:false, error: failed.join(' | ') || 'delivery failed' }, 502);
}
