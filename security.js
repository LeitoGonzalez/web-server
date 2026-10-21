const path = require('path');

/**
 * Valida y normaliza la ruta solicitada para prevenir ataques de Directory Traversal.
 * Resuelve la ruta con path.resolve() y verifica estrictamente que comience con el DocumentRoot.
 *
 * @param {string} documentRoot - Ruta relativa o absoluta del directorio público
 * @param {string} requestUrl - URL solicitada por el cliente (ej: "/index.html" o "/../../archivo")
 * @returns {{ isSafe: boolean, path: string | null }}
 */
function sanitizePath(documentRoot, requestUrl) {
  try {
    // 1. Resolver la ruta absoluta del DocumentRoot
    const absoluteRoot = path.resolve(documentRoot);

    // 2. Extraer solo el path ignorando query params (?) y hashes (#)
    const cleanUrl = requestUrl.split('?')[0].split('#')[0];

    // 3. Decodificar caracteres URL (ej: %2e%2e -> ..)
    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(cleanUrl);
    } catch {
      // Rechazar URLs malformadas por seguridad
      return { isSafe: false, path: null };
    }

    // 4. Resolver la ruta concatenando '.' para que rutas relativas o con '../' se resuelvan
    // respecto a absoluteRoot
    const safePath = path.resolve(absoluteRoot, '.' + decodedUrl);

    // 5. Asegurar que safePath esté estrictamente dentro de absoluteRoot
    // Se agrega el separador de ruta para evitar falsos positivos tipo "/public" vs "/public_secret"
    const rootWithSep = absoluteRoot.endsWith(path.sep) ? absoluteRoot : absoluteRoot + path.sep;

    if (safePath !== absoluteRoot && !safePath.startsWith(rootWithSep)) {
      return { isSafe: false, path: null };
    }

    return { isSafe: true, path: safePath };
  } catch (err) {
    return { isSafe: false, path: null };
  }
}

module.exports = { sanitizePath };