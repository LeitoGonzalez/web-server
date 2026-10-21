const http = require('http');
const fs = require('fs');
const path = require('path');

const { sanitizePath } = require('./security');
const { basicAuth } = require('./auth');
const { logAccess, getRecentLogs, clearLogs } = require('./logger');

// Ruta y carga inicial de la configuración
const configPath = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[CONFIG ERROR] No se pudo leer config.json, usando valores por defecto:', err.message);
    return {
      port: 8080,
      documentRoot: './public',
      protectedPath: '/protected',
      authUser: 'admin',
      authPass: 'utn2026'
    };
  }
}

let config = loadConfig();

// Tabla de tipos MIME soportados
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

/**
 * Plantilla genérica para páginas de error con estilo moderno
 */
function renderErrorPage(code, title, message) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${code} ${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #161e2e; border: 1px solid #283548; padding: 2.5rem; border-radius: 12px; text-align: center; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6); }
    h1 { color: #f43f5e; margin: 0 0 1rem; font-size: 2rem; }
    p { color: #94a3b8; line-height: 1.6; margin: 0 0 1.5rem; }
    .badge { display: inline-block; background: #374151; color: #cbd5e1; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-family: monospace; margin-bottom: 1rem; }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 0.6rem 1.4rem; border-radius: 6px; text-decoration: none; font-weight: 500; }
    .btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">HTTP ${code}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/" class="btn">Volver al Inicio</a>
  </div>
</body>
</html>`;
}

/**
 * Servidor HTTP principal
 */
const server = http.createServer((req, res) => {
  const method = req.method ? req.method.toUpperCase() : 'GET';
  const urlPath = req.url.split('?')[0];

  // Métodos soportados: GET, POST, HEAD
  if (!['GET', 'POST', 'HEAD'].includes(method)) {
    logAccess(req, 405, 0);
    res.setHeader('Allow', 'GET, POST, HEAD');
    res.writeHead(405, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderErrorPage(405, 'Método No Permitido', `El método HTTP ${method} no está soportado por este servidor.`));
  }

  // ==========================================
  // 1. ENDPOINTS DE LA API DE ADMINISTRACIÓN
  // ==========================================
  if (urlPath === '/api/config') {
    // Proteger API de configuración con Basic Auth
    if (!basicAuth(req, res, config.authUser, config.authPass, 'Panel de Administración')) {
      logAccess(req, 401, 0);
      return;
    }

    if (method === 'GET') {
      const data = JSON.stringify(config, null, 2);
      logAccess(req, 200, Buffer.byteLength(data));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(data);
    }

    if (method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e6) { // Protección contra DoS
          req.socket.destroy();
        }
      });

      req.on('end', () => {
        try {
          const newSettings = JSON.parse(body);

          // Validación básica
          if (newSettings.documentRoot) config.documentRoot = String(newSettings.documentRoot).trim();
          if (newSettings.protectedPath) config.protectedPath = String(newSettings.protectedPath).trim();
          if (newSettings.authUser) config.authUser = String(newSettings.authUser).trim();
          if (newSettings.authPass) config.authPass = String(newSettings.authPass).trim();

          let portWarning = null;
          if (newSettings.port && Number(newSettings.port) !== config.port) {
            config.port = Number(newSettings.port);
            portWarning = `El puerto se actualizará a ${config.port} en el próximo reinicio del servidor.`;
          }

          // Guardar en config.json
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

          const responseData = JSON.stringify({
            success: true,
            message: 'Configuración actualizada en caliente con éxito.',
            portWarning,
            config
          });

          logAccess(req, 200, Buffer.byteLength(responseData));
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(responseData);
        } catch (err) {
          logAccess(req, 400, 0);
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: 'JSON malformado o inválido: ' + err.message }));
        }
      });
      return;
    }
  }

  if (urlPath === '/api/logs') {
    // Proteger API de logs con Basic Auth
    if (!basicAuth(req, res, config.authUser, config.authPass, 'Panel de Administración')) {
      logAccess(req, 401, 0);
      return;
    }

    if (method === 'GET') {
      const logs = getRecentLogs(100);
      logAccess(req, 200, Buffer.byteLength(logs));
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(logs);
    }

    if (method === 'POST') {
      clearLogs();
      const msg = JSON.stringify({ success: true, message: 'Logs limpiados con éxito.' });
      logAccess(req, 200, Buffer.byteLength(msg));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(msg);
    }
  }

  // ==========================================
  // 2. SEGURIDAD: PREVENCIÓN DE DIRECTORY TRAVERSAL
  // ==========================================
  const { isSafe, path: filePath } = sanitizePath(config.documentRoot, req.url);

  if (!isSafe) {
    const errorHtml = renderErrorPage(
      403,
      '403 Forbidden',
      'Acceso denegado fuera del DocumentRoot. Se ha detectado y bloqueado un intento de Directory Traversal.'
    );
    logAccess(req, 403, Buffer.byteLength(errorHtml));
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    if (method === 'HEAD') return res.end();
    return res.end(errorHtml);
  }

  // ==========================================
  // 3. AUTENTICACIÓN BÁSICA HTTP
  // ==========================================
  // Proteger rutas dentro de config.protectedPath o el panel /admin
  const isProtectedResource = (config.protectedPath && urlPath.startsWith(config.protectedPath)) ||
                              urlPath.startsWith('/admin');

  if (isProtectedResource) {
    if (!basicAuth(req, res, config.authUser, config.authPass, 'Área Restringida UTN FRM')) {
      logAccess(req, 401, 0);
      return; // basicAuth ya envió los headers 401 y WWW-Authenticate
    }
  }

  // ==========================================
  // 4. RESOLUCIÓN Y SERVICIO DE ARCHIVOS ESTÁTICOS
  // ==========================================
  let targetFile = filePath;

  // Si es un directorio, buscar index.html por defecto
  try {
    if (fs.existsSync(targetFile)) {
      const stat = fs.statSync(targetFile);
      if (stat.isDirectory()) {
        targetFile = path.join(targetFile, 'index.html');
      }
    }
  } catch (err) {
    const errorHtml = renderErrorPage(500, '500 Error Interno', 'Error al verificar el recurso solicitado.');
    logAccess(req, 500, Buffer.byteLength(errorHtml));
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    if (method === 'HEAD') return res.end();
    return res.end(errorHtml);
  }

  // Verificar si el archivo final existe
  if (!fs.existsSync(targetFile)) {
    const notFoundHtml = renderErrorPage(
      404,
      '404 Not Found',
      `El recurso solicitado <code>${req.url}</code> no existe en el servidor.`
    );
    logAccess(req, 404, Buffer.byteLength(notFoundHtml));
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    if (method === 'HEAD') return res.end();
    return res.end(notFoundHtml);
  }

  // Obtener tamaño y extensión para Content-Type y Content-Length
  try {
    const stat = fs.statSync(targetFile);
    if (!stat.isFile()) {
      const notFoundHtml = renderErrorPage(404, '404 Not Found', 'El recurso solicitado no es un archivo válido.');
      logAccess(req, 404, Buffer.byteLength(notFoundHtml));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      if (method === 'HEAD') return res.end();
      return res.end(notFoundHtml);
    }

    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Manejo de petición HEAD: cabeceras completas sin cuerpo
    if (method === 'HEAD') {
      logAccess(req, 200, 0);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Last-Modified': stat.mtime.toUTCString(),
        'Server': 'UTN-FRM-HttpServer/1.0'
      });
      return res.end();
    }

    // Manejo de petición GET
    fs.readFile(targetFile, (readErr, data) => {
      if (readErr) {
        const errorHtml = renderErrorPage(500, '500 Error Interno', 'No se pudo leer el archivo solicitado.');
        logAccess(req, 500, Buffer.byteLength(errorHtml));
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(errorHtml);
      }

      logAccess(req, 200, data.length);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Last-Modified': stat.mtime.toUTCString(),
        'Server': 'UTN-FRM-HttpServer/1.0'
      });
      res.end(data);
    });

  } catch (err) {
    const errorHtml = renderErrorPage(500, '500 Error Interno', 'Error al procesar la solicitud: ' + err.message);
    logAccess(req, 500, Buffer.byteLength(errorHtml));
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    if (method === 'HEAD') return res.end();
    return res.end(errorHtml);
  }
});

server.listen(config.port, () => {
  const absRoot = path.resolve(config.documentRoot);
  console.log(`\n======================================================`);
  console.log(`SERVIDOR WEB HTTP (UTN FRM - Redes de Información)`);
  console.log(`======================================================`);
  console.log(`Escuchando en:      http://localhost:${config.port}`);
  console.log(`DocumentRoot:       ${absRoot}`);
  console.log(`Directorio Seguro:  http://localhost:${config.port}${config.protectedPath}`);
  console.log(`Panel de Control:   http://localhost:${config.port}/admin`);
  console.log(`Credenciales:       ${config.authUser} / ${config.authPass}`);
  console.log(`======================================================\n`);
});

// Manejo de cierre seguro
process.on('SIGINT', () => {
  console.log('\nCerrando servidor HTTP...');
  server.close(() => {
    console.log('Servidor detenido correctamente.');
    process.exit(0);
  });
});
