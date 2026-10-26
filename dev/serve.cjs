const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4178);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.mp3':'audio/mpeg','.wav':'audio/wav','.pdf':'application/pdf'};
http.createServer((req,res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (pathname.includes('\0') || (file !== root && !file.startsWith(root + path.sep))) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      // Sparse development checkout: public media stays on its original host.
      if (/^\/(?:resources|audio)\//.test(pathname)) {
        res.writeHead(302, {Location:'https://rroboter7-hue.github.io/new-concept-study-room' + encodeURI(pathname)});
      } else res.writeHead(404);
      res.end(); return;
    }
    const realFile = fs.realpathSync(file);
    if (!realFile.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','Content-Length':stat.size});
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(realFile).on('error',()=>res.destroy()).pipe(res);
  });
}).listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}`));
