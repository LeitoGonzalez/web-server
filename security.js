const path = require('path');

// Evita que intenten salir de la carpeta publica con ../
function sanitizePath(documentRoot, requestUrl) {
  try {
    // Ruta absoluta de la carpeta publica
    const absoluteRoot = path.resolve(documentRoot);

    // Sacamos signos de pregunta o hash de la url
    const cleanUrl = requestUrl.split('?')[0].split('#')[0];

    // Decodificamos por si mandan cosas como %2e%2e
    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(cleanUrl);
    } catch {
      return { isSafe: false, path: null };
    }

    // Ponemos '.' adelante para que path.resolve lo tome como ruta relativa
    const safePath = path.resolve(absoluteRoot, '.' + decodedUrl);

    // Verificamos que el archivo este si o si adentro de public
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