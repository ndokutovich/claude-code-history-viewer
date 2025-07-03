const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/latest.json') {
    // latest.json 파일 제공
    const filePath = path.join(__dirname, 'latest.json');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
  } else if (req.url.endsWith('.dmg') || req.url.endsWith('.msi') || req.url.endsWith('.deb')) {
    // 실제 파일 대신 빈 파일을 반환 (테스트용)
    console.log(`📦 바이너리 파일 요청: ${req.url}`);
    res.writeHead(200, { 
      'Content-Type': 'application/octet-stream',
      'Content-Length': '1024' // 작은 크기로 설정
    });
    res.end(Buffer.alloc(1024)); // 1KB 빈 파일
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Test update server running at http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log(`  - http://localhost:${PORT}/latest.json`);
  console.log(`  - http://localhost:${PORT}/Claude-Code-History-Viewer_1.0.0-beta.3_universal.dmg`);
  console.log(`  - http://localhost:${PORT}/Claude-Code-History-Viewer_1.0.0-beta.3_aarch64.dmg`);
  console.log(`  - http://localhost:${PORT}/Claude-Code-History-Viewer_1.0.0-beta.3_x64.dmg`);
  console.log(`  - http://localhost:${PORT}/Claude-Code-History-Viewer_1.0.0-beta.3_x64.msi`);
  console.log(`  - http://localhost:${PORT}/Claude-Code-History-Viewer_1.0.0-beta.3_amd64.deb`);
});