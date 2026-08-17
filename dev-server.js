// Local dev server. Serves birthday.html with .env injected on every request,
// so you can edit .env or the HTML and just hit refresh.
//   node dev-server.js
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { loadEnv, toConfig, injectConfig } = require('./env-config');

const ROOT  = __dirname;
const PORT  = Number(process.env.PORT) || 5173;
const ENTRY = 'birthday.html';

const TYPES = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.webp':'image/webp', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.mp4':'video/mp4'
};

// never serve secrets or tooling over HTTP
const BLOCKED = new Set(['.env', '.env.local', '.env.example',
                         'env-config.js', 'dev-server.js', 'build.js']);

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if(rel === '/' || rel === '') rel = '/' + ENTRY;

  const base = path.basename(rel).toLowerCase();
  if(BLOCKED.has(base) || base.startsWith('.env')){
    res.writeHead(403).end('Forbidden');
    console.log('403 ' + rel);
    return;
  }

  const file = path.normalize(path.join(ROOT, rel));
  if(!file.startsWith(path.normalize(ROOT))){
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, buf) => {
    if(err){
      res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'});
      res.end('<h1>404</h1><p>Not found: ' + rel + '</p>');
      console.log('404 ' + rel);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    let body = buf;

    if(ext === '.html'){
      const cfg = toConfig(loadEnv(ROOT));      // re-read .env every request
      body = Buffer.from(injectConfig(buf.toString('utf8'), cfg), 'utf8');
    }

    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(body);
    console.log('200 ' + rel);
  });
}).listen(PORT, () => {
  const cfg = toConfig(loadEnv(ROOT));
  const keys = Object.keys(cfg);
  console.log('Birthday site — http://localhost:' + PORT);
  console.log(keys.length
    ? '.env loaded: ' + keys.join(', ')
    : 'no .env values found — using the defaults in birthday.html');
});
