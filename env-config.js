// Reads .env (local) or process.env (Vercel/Netlify) and turns it into the
// config object the page expects.
// Shared by dev-server.js, build.js and telegram-check.js.
const fs   = require('fs');
const path = require('path');

const MAP = {
  userName:          'USER_NAME',
  fromName:          'FROM_NAME',
  birthDate:         'BIRTH_DATE',
  telegramProxyUrl:  'TELEGRAM_PROXY_URL',
  telegramToken:     'TELEGRAM_TOKEN',
  telegramChatId:    'TELEGRAM_CHAT_ID',
  whatsapp:          'WHATSAPP',
  email:             'EMAIL',
  formsubmitEmail:   'FORMSUBMIT_EMAIL',
  emailjsServiceId:  'EMAILJS_SERVICE_ID',
  emailjsTemplateId: 'EMAILJS_TEMPLATE_ID',
  emailjsPublicKey:  'EMAILJS_PUBLIC_KEY'
};

/* Keys that must NEVER be baked into the page when a server is available.
   On Vercel these stay as environment variables and only api/send.js
   ever sees them. */
const SERVER_ONLY = new Set([
  'telegramToken', 'telegramChatId', 'formsubmitEmail', 'email'
]);

function parseEnv(text){
  const out = {};
  text.split(/\r?\n/).forEach(line => {
    const s = line.trim();
    if(!s || s.startsWith('#')) return;
    const i = s.indexOf('=');
    if(i < 1) return;
    const key = s.slice(0, i).trim();
    let val   = s.slice(i + 1).trim();
    if((val.startsWith('"') && val.endsWith('"')) ||
       (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[key] = val;
  });
  return out;
}

function loadEnv(dir){
  const file = path.join(dir, '.env');
  const merged = fs.existsSync(file)
    ? parseEnv(fs.readFileSync(file, 'utf8'))
    : {};
  // real environment variables win — that's how Vercel injects at build time
  for(const envKey of Object.values(MAP)){
    if(process.env[envKey]) merged[envKey] = process.env[envKey];
  }
  return merged;
}

/* serverMode = there's a /api/send function to do the delivering,
   so secrets are withheld from the page entirely. */
function isServerMode(){
  return !!(process.env.VERCEL || process.env.USE_API);
}

function toConfig(env, { serverMode = isServerMode() } = {}){
  const cfg = {};
  for(const [k, envKey] of Object.entries(MAP)){
    if(serverMode && SERVER_ONLY.has(k)) continue;   // stays on the server
    const v = env[envKey];
    if(v !== undefined && v !== '') cfg[k] = v;
  }
  if(serverMode) cfg.apiEnabled = true;
  return cfg;
}

// </script> inside a JSON string would close the tag early
const safeJson = obj => JSON.stringify(obj).replace(/</g, '\\u003c');

function injectConfig(html, cfg){
  const tag = `<script>window.__BIRTHDAY_CONFIG__ = ${safeJson(cfg)};</script>\n</head>`;
  return html.includes('</head>')
    ? html.replace('</head>', tag)
    : `<script>window.__BIRTHDAY_CONFIG__ = ${safeJson(cfg)};</script>\n` + html;
}

module.exports = { parseEnv, loadEnv, toConfig, injectConfig, isServerMode, MAP, SERVER_ONLY };
