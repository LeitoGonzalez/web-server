function basicAuth(req, res, user, pass, realm = 'Zona Protegida UTN') {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', `Basic realm="${realm}"`);
        res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>401 No Autorizado</h1><p>Se requiere usuario y contraseña.</p>');
        return false;
    } // El header viene como: "Basic dXN1YXJpbzpjb250cmFzZcOxYQ==" 
    const auth = Buffer.from(authHeader.split(' ')[1] || '', 'base64').toString().split(':');
    const reqUser = auth[0];
    const reqPass = auth[1];
    if (reqUser === user && reqPass === pass) {
        return true;
    }
    res.setHeader('WWW-Authenticate', `Basic realm="${realm}"`);
    res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>401 Credenciales Incobrectas</h1>');
    return false;
}
module.exports = { basicAuth };
