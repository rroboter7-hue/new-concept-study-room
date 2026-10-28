const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4178);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.mp3':'audio/mpeg','.wav':'audio/wav','.pdf':'application/pdf'};
const server = http.createServer((req,res) => {
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
        const published = /^\/audio\/.*\.wav$/i.test(pathname)
          ? '/audio/optimized/' + pathname.slice('/audio/'.length).replace(/\.wav$/i, '.mp3')
          : pathname;
        res.writeHead(302, {Location:'https://rroboter7-hue.github.io/new-concept-study-room' + encodeURI(published)});
      } else res.writeHead(404);
      res.end(); return;
    }
    const realFile = fs.realpathSync(file);
    if (!realFile.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const headers = {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','Content-Length':stat.size,'Accept-Ranges':'bytes'};
    let start = 0;
    let end = stat.size - 1;
    let status = 200;
    // Range applies to GET. HEAD reports the complete representation without a body.
    if (req.method === 'GET' && req.headers.range !== undefined) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range.trim());
      let valid = !!match && !!(match[1] || match[2]) && stat.size > 0;
      if (valid) {
        const first = match[1] ? Number(match[1]) : null;
        const last = match[2] ? Number(match[2]) : null;
        valid = (first === null || Number.isSafeInteger(first)) && (last === null || Number.isSafeInteger(last));
        if (first === null) {
          valid = valid && last > 0;
          start = Math.max(0, stat.size - last);
        } else {
          start = first;
          end = last === null ? end : Math.min(last, end);
          valid = valid && start < stat.size && start <= end;
        }
      }
      if (!valid) {
        res.writeHead(416, {...headers,'Content-Length':0,'Content-Range':`bytes */${stat.size}`});
        res.end(); return;
      }
      status = 206;
      headers['Content-Length'] = end - start + 1;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    res.writeHead(status, headers);
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(realFile, status === 206 ? {start,end} : undefined).on('error',()=>res.destroy()).pipe(res);
  });
}).listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${server.address().port}`));
