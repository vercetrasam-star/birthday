// Bakes .env into a single deployable file: dist/index.html
//   node build.js
const fs   = require('fs');
const path = require('path');
const { loadEnv, toConfig, injectConfig } = require('./env-config');

const ROOT = __dirname;
const OUT  = path.join(ROOT, 'dist');

const env  = loadEnv(ROOT);
const cfg  = toConfig(env);
const html = fs.readFileSync(path.join(ROOT, 'birthday.html'), 'utf8');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), injectConfig(html, cfg), 'utf8');

const kb = (fs.statSync(path.join(OUT, 'index.html')).size / 1024).toFixed(0);
console.log(`\n  ✔ dist/index.html  (${kb} KB)`);
console.log('    injected: ' + (Object.keys(cfg).join(', ') || 'nothing — .env is empty'));

// tell the truth about what just got baked in
if(cfg.apiEnabled){
  const chans = [
    process.env.FORMSUBMIT_EMAIL && 'email',
    (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) && 'telegram'
  ].filter(Boolean);
  console.log('\n  ✔ Server mode — api/send.js does the delivering.');
  console.log('    No email address or token is in the page. Safe to host publicly.');
  console.log(chans.length
    ? '    Server will deliver via: ' + chans.join(' + ')
    : '    ⚠  No FORMSUBMIT_EMAIL or TELEGRAM_* set in the environment —\n'
    + '       add them in Vercel → Settings → Environment Variables,\n'
    + '       otherwise her reply falls back to WhatsApp.');
  console.log('');
} else if(cfg.telegramToken){
  console.log('\n  ⚠  TELEGRAM_TOKEN is now INSIDE dist/index.html in plain text.');
  console.log('     Anyone who opens "view source" on the hosted page can read it.');
  console.log('     • fine for a private link you send to one person');
  console.log('     • /revoke the bot in BotFather once you have her reply');
  console.log('     • to avoid this entirely: deploy worker/telegram-proxy.js');
  console.log('       and set TELEGRAM_PROXY_URL instead\n');
} else if(cfg.telegramProxyUrl){
  console.log('\n  ✔ Using the proxy — no secret in the built file. Safe to host anywhere.\n');
} else {
  console.log('\n  ℹ No Telegram configured. Her reply will fall back to');
  console.log('    WhatsApp / share sheet / clipboard.\n');
}

console.log('  dist/ is gitignored. Deploy it with a CLI or drag-and-drop:');
console.log('    npx wrangler pages deploy dist      (Cloudflare)');
console.log('    npx netlify deploy --prod --dir dist');
console.log('    npx vercel deploy --prod dist\n');
