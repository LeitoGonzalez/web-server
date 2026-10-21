const path = require('path');
function sanitizePath(documentRoot, requestUrl) {
    // Resolver la ruta absoluta del DocumentRoot
    const absoluteRoot = path.resolve(documentRoot);
    // Limpiar la URL de query params
    const cleanUrl = requestUrl.split('?')[0];
    // Resolver la ruta absoluta del archivo solicitado
    const safePath = path.resolve(absoluteRoot, '.' + cleanUrl);
    // Verificar que la ruta solicitada comience estrictamente con el DocumentRoot
    if (!safePath.startsWith(absoluteRoot)) {
        return { isSafe: false, path: null };
    }
    return { isSafe: true, path: safePath };
}
module.exports = { sanitizePath };