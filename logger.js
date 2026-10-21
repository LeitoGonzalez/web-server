const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'access.log');

/**
 * Registra una solicitud HTTP en la consola y de forma persistente en logs/access.log
 * Formato estándar: [Fecha/Hora] IP - "Método URL HTTP/versión" Código Bytes "User-Agent"
 * @param {import('http').IncomingMessage} req
 * @param {number} statusCode
 * @param {number} [bytesSent=0]
 */
function logAccess(req, statusCode, bytesSent = 0) {
  const timestamp = new Date().toISOString();
  let ip = req.socket.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';

  // Normalizar IPv6 loopback (::1 o ::ffff:127.0.0.1) a 127.0.0.1 para mayor claridad
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }

  const method = req.method || 'UNKNOWN';
  const url = req.url || '/';
  const httpVersion = req.httpVersion || '1.1';
  const userAgent = req.headers['user-agent'] || 'Desconocido';

  const logLine = `[${timestamp}] ${ip} - "${method} ${url} HTTP/${httpVersion}" ${statusCode} ${bytesSent} "${userAgent}"\n`;

  // Color de consola según status code
  let statusColor = '\x1b[32m'; // verde 2xx
  if (statusCode >= 300 && statusCode < 400) statusColor = '\x1b[36m'; // cyan 3xx
  if (statusCode >= 400 && statusCode < 500) statusColor = '\x1b[33m'; // amarillo 4xx
  if (statusCode >= 500) statusColor = '\x1b[31m'; // rojo 5xx
  const resetColor = '\x1b[0m';

  console.log(`[${timestamp}] ${ip} - "\x1b[35m${method}\x1b[0m ${url}" ${statusColor}${statusCode}${resetColor} ${bytesSent}B`);

  // Persistir en logs/access.log
  fs.appendFile(logFile, logLine, 'utf8', (err) => {
    if (err) {
      console.error('[LOGGER ERROR] Fallo al escribir en access.log:', err);
    }
  });
}

/**
 * Obtiene las últimas N líneas del archivo access.log
 * @param {number} [lines=50]
 * @returns {string}
 */
function getRecentLogs(lines = 50) {
  if (!fs.existsSync(logFile)) {
    return 'Sin registros aún.';
  }
  try {
    const raw = fs.readFileSync(logFile, 'utf8');
    const allLines = raw.trim().split('\n').filter(Boolean);
    if (allLines.length === 0) return 'Sin registros aún.';
    return allLines.slice(-lines).join('\n');
  } catch (err) {
    return `Error al leer logs: ${err.message}`;
  }
}

/**
 * Limpia el archivo de logs
 */
function clearLogs() {
  try {
    fs.writeFileSync(logFile, '', 'utf8');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  logAccess,
  getRecentLogs,
  clearLogs,
  logFile
};
