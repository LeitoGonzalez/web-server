// Middleware de autenticacion basica
function basicAuth(req, res, user, pass, realm = 'Zona Protegida UTN FRM') {
  const authHeader = req.headers['authorization'];

  // Si no mandaron la cabecera de autorizacion, devolvemos 401
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>401 No Autorizado</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; border: 1px solid #334155; padding: 2.5rem; border-radius: 12px; text-align: center; max-width: 450px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    h1 { color: #f43f5e; margin: 0 0 1rem; font-size: 1.8rem; }
    p { color: #94a3b8; line-height: 1.6; margin: 0 0 1.5rem; }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; font-weight: 500; }
    .btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <h1>401 No Autorizado</h1>
    <p>Se requiere usuario y contraseña para entrar acá.</p>
    <a href="/" class="btn">Volver al Inicio</a>
  </div>
</body>
</html>`);
    return false;
  }

  // Viene en base64: "Basic dXN1YXJpbzpjb250cmFzZcOxYQ=="
  const base64Credentials = authHeader.split(' ')[1] || '';
  let decoded = '';
  try {
    decoded = Buffer.from(base64Credentials, 'base64').toString('utf8');
  } catch {
    decoded = '';
  }

  // Separamos usuario y clave por los dos puntos
  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) {
    res.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>401 Credenciales Invalidas</h1>');
    return false;
  }

  const reqUser = decoded.slice(0, colonIndex);
  const reqPass = decoded.slice(colonIndex + 1);

  // Si coinciden dejamos pasar
  if (reqUser === user && reqPass === pass) {
    return true;
  }

  // Si puso mal el usuario o la clave
  res.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
  res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>401 Credenciales Incorrectas</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; border: 1px solid #ef4444; padding: 2.5rem; border-radius: 12px; text-align: center; max-width: 450px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    h1 { color: #ef4444; margin: 0 0 1rem; font-size: 1.8rem; }
    p { color: #94a3b8; line-height: 1.6; margin: 0 0 1.5rem; }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; font-weight: 500; }
    .btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <h1>401 Credenciales Incorrectas</h1>
    <p>El usuario o la contraseña no son correctos.</p>
    <a href="/" class="btn">Volver al Inicio</a>
  </div>
</body>
</html>`);
  return false;
}

module.exports = { basicAuth };
