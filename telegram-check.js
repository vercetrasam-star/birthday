// Diagnoses a broken Telegram bot in one command:  node telegram-check.js
// Reads .env, checks the token, finds your chat id, sends a real test message.
const { loadEnv } = require('./env-config');

const env    = loadEnv(__dirname);
const token  = (env.TELEGRAM_TOKEN  || '').trim().replace(/^["']|["']$/g, '');
const chatId = (env.TELEGRAM_CHAT_ID || '').trim().replace(/^["']|["']$/g, '');

const api = (m, q = '') => `https://api.telegram.org/bot${token}/${m}${q}`;
const line = () => console.log('─'.repeat(58));

async function call(method, query = ''){
  const res = await fetch(api(method, query));
  return res.json();
}

(async () => {
  line();
  console.log('  TELEGRAM BOT CHECK');
  line();

  /* ── 1. token present? ── */
  if(!token){
    console.log('\n  ✖  TELEGRAM_TOKEN is empty in .env\n');
    console.log('     Open Telegram → message @BotFather → /newbot');
    console.log('     Copy the token (looks like 8123456789:AAH...)\n');
    return;
  }
  if(!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)){
    console.log('\n  ✖  That token is malformed.');
    console.log('     Got: ' + token.slice(0, 14) + '...  (length ' + token.length + ')');
    console.log('     Expected: digits, then a colon, then ~35 characters.');
    console.log('     Common cause: quotes or a stray space in .env\n');
    return;
  }
  console.log('\n  token format  ✓');

  /* ── 2. is the token live? ── */
  let me;
  try{
    me = await call('getMe');
  }catch(err){
    console.log('\n  ✖  Could not reach api.telegram.org');
    console.log('     ' + err.message);
    console.log('\n     Telegram is blocked on some Indian ISPs (Jio especially).');
    console.log('     Try mobile data, or skip Telegram — see the fallbacks below.\n');
    return;
  }
  if(!me.ok){
    console.log('\n  ✖  Telegram rejected the token: ' + me.description);
    console.log('     It was probably revoked. /newbot or /revoke in BotFather.\n');
    return;
  }
  console.log('  token valid   ✓   bot is @' + me.result.username);

  /* ── 3. chat id ── */
  if(!chatId){
    console.log('  chat id       ✖   TELEGRAM_CHAT_ID is empty\n');
    line();
    const up = await call('getUpdates');
    const chats = new Map();
    (up.result || []).forEach(u => {
      const c = (u.message || u.channel_post || {}).chat;
      if(c) chats.set(c.id, c);
    });

    if(!chats.size){
      console.log('\n  Telegram has no messages for this bot yet.\n');
      console.log('  DO THIS:');
      console.log('   1. Open Telegram, search  @' + me.result.username);
      console.log('   2. Press START and send it any message');
      console.log('   3. Run  node telegram-check.js  again\n');
      console.log('  (A bot cannot message you until you message it first —');
      console.log('   this is the single most common reason it "does not work".)\n');
    } else {
      console.log('\n  Found your chat id. Put this in .env:\n');
      for(const c of chats.values()){
        const who = c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username;
        console.log(`     TELEGRAM_CHAT_ID=${c.id}      ← ${who} (${c.type})`);
      }
      console.log('');
    }
    return;
  }

  /* ── 4. actually send something ── */
  const test = await call('sendMessage',
    `?chat_id=${encodeURIComponent(chatId)}` +
    `&text=${encodeURIComponent('✅ Test from the birthday site. If you can read this, it works.')}`);

  if(test.ok){
    console.log('  test message  ✓   check your Telegram now\n');
    line();
    console.log('\n  All good. Her note, her wish and any recording will arrive here.\n');
    return;
  }

  console.log('  test message  ✖   ' + test.description + '\n');
  line();
  const d = (test.description || '').toLowerCase();
  if(d.includes('chat not found')){
    console.log('\n  That chat id does not exist for this bot.');
    console.log('  Almost always: you never sent the bot a message.\n');
    console.log('   1. Open @' + me.result.username + ' in Telegram, press START, say hi');
    console.log('   2. Clear TELEGRAM_CHAT_ID in .env');
    console.log('   3. Run this again — it will print the correct id\n');
  } else if(d.includes('blocked')){
    console.log('\n  You blocked the bot. Unblock it in Telegram and retry.\n');
  } else if(d.includes('deactivated')){
    console.log('\n  The bot was deleted. Make a new one with /newbot.\n');
  } else {
    console.log('\n  Full response:\n');
    console.log('  ' + JSON.stringify(test) + '\n');
  }
})().catch(e => {
  console.log('\n  ✖  ' + e.message + '\n');
});
