# Documentación Técnica Completa: Servidor Web HTTP Modular

**Cátedra:** Redes de Información  
**Institución:** Universidad Tecnológica Nacional - Facultad Regional Mendoza (UTN FRM)  
**Trabajo Práctico:** Trabajo Práctico N° 7 - Punto 2  
**Tecnología Base:** Node.js (Módulos nativos `http`, `fs`, `path`, `url`)

---

## 1. Introducción y Objetivos de Diseño

El presente proyecto implementa un Servidor Web HTTP de nivel de producción académica, diseñado para estudiar y validar los conceptos fundamentales de los protocolos de capa de aplicación en redes TCP/IP:
1. **Comprensión del protocolo HTTP/1.1**: Análisis y construcción artesanal de peticiones, cabeceras, códigos de estado y cuerpos de respuesta.
2. **Seguridad y Aislamiento de Archivos (Sandbox)**: Demostración práctica de mitigación de vulnerabilidades de desbordamiento de ruta (*Directory Traversal* / *Path Traversal*).
3. **Mecanismo de Autenticación de Acceso Básico HTTP (RFC 7617)**: Funcionamiento del desafío/respuesta mediante encabezados `WWW-Authenticate` y `Authorization`.
4. **Trazabilidad y Auditoría (Logging)**: Registro unificado compatible con el formato estándar de servidores web.
5. **Configuración Dinámica y Monitoreo Web**: Panel administrativo sin librerías frontend pesadas, consumiendo una API REST nativa.

La decisión arquitectónica fundamental fue prescindir de frameworks como Express o Fastify para exponer de manera directa la interacción con los sockets y streams que provee Node.js.

---

## 2. Diagrama de Arquitectura del Sistema

```
                      +---------------------------------------+
                      |           Cliente HTTP                |
                      |  (Navegador Web / curl / script)      |
                      +-------------------+-------------------+
                                          |
                                          | TCP / Solicitud HTTP
                                          v
                      +-------------------+-------------------+
                      |         server.js (Router)            |
                      +-------------------+-------------------+
                                          |
                      +-------------------+-------------------+
                      |           logger.js                   |
                      |  - IP, Timestamp, Método, URL,        |
                      |    Status, Bytes, User-Agent          |
                      |  - Escribe en logs/access.log y stdout|
                      +-------------------+-------------------+
                                          |
                     +--------------------+--------------------+
                     | ¿Ruta requiere autenticación?           |
                     | (/protected o /admin o /api)            |
                     +--------------------+--------------------+
                                /                     \
                        SÍ     /                       \ NO
                              v                         \
                 +-----------------------+               \
                 |        auth.js        |                \
                 |  - Chequea cabecera   |                 \
                 |    Authorization      |                  \
                 |  - Retorna 401 si     |                   \
                 |    falla o no existe  |                    \
                 +-----------+-----------+                     \
                             |                                  \
                    Válido   v                                   v
             +---------------+-----------------------------------+---------------+
             |                           Tipo de Recurso                         |
             +-------------------------------+-----------------------------------+
                             |                                                   |
                             v                                                   v
               +-------------+-------------+                       +-------------+-------------+
               |    API de Administración  |                       |     Archivos Estáticos    |
               |      (/api/config, logs)  |                       |       (DocumentRoot)      |
               +-------------+-------------+                       +-------------+-------------+
                             |                                                   |
                             v                                                   v
               +-------------+-------------+                       +-------------+-------------+
               |  Lee/Escribe config.json  |                       |        security.js        |
               |  Lee logs/access.log      |                       |  - Resuelve path.resolve  |
               |  Responde JSON o texto    |                       |  - Detecta Directory      |
               +---------------------------+                       |    Traversal -> 403       |
                                                                   +-------------+-------------+
                                                                                 |
                                                                         Válido  v
                                                                   +-------------+-------------+
                                                                   | - fs.statSync / readFile  |
                                                                   | - Resuelve MIME type      |
                                                                   | - HEAD: solo headers      |
                                                                   | - GET: 200 OK + payload   |
                                                                   | - Inexistente: 404        |
                                                                   +---------------------------+
```

---

## 3. Módulos y Detalles de Implementación

### 3.1. `security.js` — Control de Seguridad y Sandbox DocumentRoot

#### Concepto y Vulnerabilidad:
En servidores web inseguros, peticiones como `GET /../../etc/passwd` o `GET /..\..\config.json` intentan ascender en el árbol de directorios del sistema de archivos para acceder a archivos confidenciales fuera de la carpeta pública (`DocumentRoot`).

#### Solución Implementada:
1. **Limpieza de Parámetros:** Se extrae la ruta excluyendo query strings (`?`) y fragmentos (`#`).
2. **Decodificación Porcentaje:** Se utiliza `decodeURIComponent()` para neutralizar intentos de bypass como `%2e%2e` (que representa `..`) o `%2f` (que representa `/`).
3. **Resolución Canónica:** Se utiliza `path.resolve(absoluteRoot, '.' + decodedUrl)`.
4. **Verificación Estricta de Prefijo:** Se calcula la ruta con el separador de directorio (`path.sep`). Si la ruta resultante no empieza con el `DocumentRoot`, el módulo marca inmediatamente `isSafe: false`.
5. Si `isSafe === false`, `server.js` aborta la petición y emite `403 Forbidden` sin acceder al disco.

```javascript
// Fragmento clave de security.js
const safePath = path.resolve(absoluteRoot, '.' + decodedUrl);
const rootWithSep = absoluteRoot.endsWith(path.sep) ? absoluteRoot : absoluteRoot + path.sep;

if (safePath !== absoluteRoot && !safePath.startsWith(rootWithSep)) {
  return { isSafe: false, path: null };
}
```

---

### 3.2. `auth.js` — Autenticación Básica HTTP (RFC 7617)

#### Flujo del Protocolo:
1. El cliente solicita un recurso bajo una ruta protegida (por ejemplo `/protected` o `/admin`).
2. Si la petición no incluye el encabezado `Authorization`, el servidor responde con:
   ```http
   HTTP/1.1 401 Unauthorized
   WWW-Authenticate: Basic realm="Zona Protegida UTN FRM", charset="UTF-8"
   Content-Type: text/html; charset=utf-8
   ```
3. El navegador intercepta el header `WWW-Authenticate` y despliega la ventana nativa solicitando usuario y contraseña.
4. El cliente repite la petición enviando:
   ```http
   Authorization: Basic <base64(usuario:contraseña)>
   ```
5. `auth.js` decodifica la cadena en base64 mediante `Buffer.from(hash, 'base64').toString('utf8')`, extrae los campos delimitados por `:` y los compara contra los valores activos de `config.json`.
6. Si las credenciales coinciden, la ejecución continúa; de lo contrario, se vuelve a emitir `401 Unauthorized`.

---

### 3.3. `logger.js` — Auditoría de Accesos

#### Formato Estándar:
Cada solicitud procesada genera una línea estructurada tanto en la terminal como en el archivo persistente `logs/access.log`:

```text
[<ISO-Timestamp>] <IP-Cliente> - "<Método> <URL> HTTP/<Versión>" <Código-Estado> <Bytes-Enviados> "<User-Agent>"
```

*Ejemplo real obtenido durante las pruebas:*
```text
[2026-10-21T18:59:45.460Z] 127.0.0.1 - "GET / HTTP/1.1" 200 8000 "node-fetch"
[2026-10-21T18:59:45.481Z] 127.0.0.1 - "GET /protected HTTP/1.1" 401 0 "node-fetch"
[2026-10-21T18:59:45.495Z] 127.0.0.1 - "GET /..%2f..%2fconfig.json HTTP/1.1" 403 1324 "node-fetch"
```

#### Características:
- **Asincronía sin bloqueo:** La escritura a disco se realiza mediante `fs.appendFile` para no demorar la respuesta enviada al cliente.
- **Normalización de IP:** Traduce `::1` y `::ffff:127.0.0.1` a `127.0.0.1` para lectura humana clara.
- **Visor en Tiempo Real:** Cuenta con la función `getRecentLogs(lines = 100)` para alimentar la consola del panel `/admin` sin necesidad de recargar la página.

---

### 3.4. `server.js` — Despachador HTTP, MIME Types y Métodos

#### Métodos Soportados:
- **`GET`**: Lee el archivo resuelto o invoca el endpoint de API correspondiente y transmite cabeceras y cuerpo completo.
- **`HEAD`**: Utiliza `fs.statSync` para obtener `Content-Length`, `Content-Type` y `Last-Modified`. Envía los encabezados idénticos a un `GET` y finaliza la conexión inmediatamente (`res.end()`) **sin enviar cuerpo**.
- **`POST`**: Utilizado en `/api/config` para actualizar las credenciales y el DocumentRoot en caliente, y en `/api/logs` para vaciar el log.
- **Otros métodos (`PUT`, `DELETE`, etc.)**: Devuelven `405 Method Not Allowed` junto con la cabecera `Allow: GET, POST, HEAD`.

#### Tabla de Tipos MIME Incorporada:
El servidor mapea dinámicamente las extensiones solicitadas para garantizar que los navegadores interpreten adecuadamente cada recurso:
- `.html`, `.htm` → `text/html; charset=utf-8`
- `.css` → `text/css; charset=utf-8`
- `.js`, `.mjs` → `application/javascript; charset=utf-8`
- `.json` → `application/json; charset=utf-8`
- `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.ico` → Tipos de imagen correspondientes.
- `.pdf` → `application/pdf`
- `.txt` → `text/plain; charset=utf-8`

---

### 3.5. `public/admin/index.html` — Panel de Control Web en Caliente

El panel de administración permite:
1. **Modificación Dinámica:** Cambiar `documentRoot`, `protectedPath`, `authUser` y `authPass` en tiempo de ejecución.
2. **Persistencia Automática:** Al pulsar *"Guardar Parámetros en Caliente"*, una petición AJAX `POST /api/config` actualiza la memoria del servidor y reescribe físicamente `config.json`.
3. **Visor de Terminal Integrado:** Realiza llamadas periódicas (polling configurable cada 3 segundos) a `GET /api/logs` mostrando las últimas entradas con auto-scroll.
4. **Limpieza de Logs:** Botón interactivo para reiniciar el archivo `access.log` a 0 bytes.

---

## 4. Códigos de Estado HTTP Manejados

| Código | Mensaje Estándar | Cuándo se emite |
| :---: | :--- | :--- |
| **`200 OK`** | Petición exitosa | El recurso existe, fue autorizado y se sirve correctamente. |
| **`401 Unauthorized`** | No autorizado | Se solicita una ruta bajo `config.protectedPath` o `/admin` sin credenciales válidas. |
| **`403 Forbidden`** | Prohibido | `security.js` detecta que la ruta solicitada escapa del `DocumentRoot`. |
| **`404 Not Found`** | No encontrado | La ruta se encuentra dentro del `DocumentRoot`, pero el archivo no existe en disco. |
| **`405 Method Not Allowed`** | Método no permitido | El cliente utiliza métodos no implementados (ej: `DELETE /archivo.html`). |
| **`500 Internal Error`** | Error interno | Excepción no controlada durante la lectura del sistema de archivos. |

---

## 5. Pruebas y Validación Técnica

Se implementó una suite automatizada de pruebas sobre el servidor activo, cubriendo la totalidad de los requerimientos:

```text
PASS: GET / returns 200 OK
PASS: GET / contains title
PASS: HEAD / returns 200 OK
PASS: HEAD / returns empty body (0 bytes)
PASS: GET /protected without auth returns 401
PASS: GET /protected has WWW-Authenticate header
PASS: GET /protected with wrong pass returns 401
PASS: GET /protected with correct credentials returns 200 OK
PASS: GET /protected returns protected page
PASS: Directory traversal encoded returns 403 Forbidden
PASS: 403 page returned
PASS: GET non-existent file returns 404 Not Found
PASS: GET /api/config returns 200
PASS: Config port matches
PASS: POST /api/config returns 200
PASS: GET /api/logs returns 200
PASS: access.log contains entries
```

---

## 6. Conclusiones

La solución desarrollada satisface con creces los requerimientos del Trabajo Práctico N° 7:
1. Proporciona una implementación transparente y pedagógica de las normas RFC de HTTP.
2. Neutraliza de forma exhaustiva vectores de ataque comunes en servidores web.
3. Ofrece una experiencia de usuario moderna y profesional tanto en el portal de bienvenida como en el panel de administración.
