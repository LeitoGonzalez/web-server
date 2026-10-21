# Servidor Web HTTP Modular (Node.js Nativo)

**Trabajo Práctico N° 7 - Redes de Información**  
**Universidad Tecnológica Nacional - Facultad Regional Mendoza (UTN FRM)**

---

## Descripción General

Este proyecto implementa un servidor web HTTP completo, modular y de alto rendimiento utilizando **Node.js nativo** (módulos `http`, `fs`, `path`), **sin frameworks externos ni dependencias de terceros**.

Incluye:
- **Sandbox de DocumentRoot**: Protección contra ataques de *Directory Traversal*.
- **HTTP Basic Authentication (RFC 7617)**: Protección por usuario y contraseña.
- **Módulo de Logging**: Registro en consola y archivo persistente `logs/access.log`.
- **Panel Web de Administración (`/admin`)**: Modificación de parámetros en caliente y visor de logs en tiempo real.
- **Soporte de Métodos y Códigos de Estado**: `GET`, `POST`, `HEAD` con respuestas `200`, `401`, `403`, `404`, `405` y `500`.

---

## Inicio Rápido

### Requisitos Previos
- **Node.js 18+** instalado (probado y verificado en Node.js 22 LTS).
- No requiere ejecutar `npm install` (cero dependencias externas).

### Ejecución del Servidor

Para iniciar el servidor en modo normal:
```bash
npm start
# O alternativamente:
node server.js
```

Para iniciar con recarga automática en desarrollo:
```bash
npm run dev
```

Una vez iniciado, la consola mostrará:
```text
======================================================
SERVIDOR WEB HTTP (UTN FRM - Redes de Información)
======================================================
Escuchando en:      http://localhost:8080
DocumentRoot:       ./public
Directorio Seguro:  http://localhost:8080/protected
Panel de Control:   http://localhost:8080/admin
Credenciales:       admin / utn2026
======================================================
```

---

## Endpoints y Rutas del Servidor

| Ruta | Método(s) | Descripción | Estado HTTP Esperado |
| :--- | :--- | :--- | :--- |
| `/` | `GET`, `HEAD` | Portal público principal | `200 OK` |
| `/protected` | `GET`, `HEAD` | Directorio restringido con Basic Auth | `401 Unauthorized` / `200 OK` |
| `/admin` | `GET`, `HEAD` | Dashboard de administración | `401 Unauthorized` / `200 OK` |
| `/api/config` | `GET` | Obtener configuración actual en JSON | `200 OK` |
| `/api/config` | `POST` | Actualizar configuración en caliente | `200 OK` |
| `/api/logs` | `GET` | Obtener últimas 100 líneas de logs | `200 OK` |
| `/api/logs` | `POST` | Limpiar archivo `access.log` | `200 OK` |
| `/..%2f..%2f...` | `GET`, `HEAD` | Intento de escape de DocumentRoot | `403 Forbidden` |
| `/no-existe` | `GET`, `HEAD` | Recurso no encontrado | `404 Not Found` |

---

## Credenciales por Defecto

* **Usuario:** `admin`
* **Contraseña:** `utn2026`

*(Pueden modificarse en caliente desde el panel web `/admin` o editando `config.json`).*

---

## Pruebas Rápidas con `curl`

### 1. Petición GET normal
```bash
curl -i http://localhost:8080/
```

### 2. Petición HEAD (verifica cabeceras sin cuerpo)
```bash
curl -I http://localhost:8080/
```

### 3. Zona Protegida sin credenciales (debe devolver 401 y `WWW-Authenticate`)
```bash
curl -i http://localhost:8080/protected
```

### 4. Zona Protegida con credenciales válidas
```bash
curl -i -u admin:utn2026 http://localhost:8080/protected
```

### 5. Simulación de ataque Directory Traversal (debe devolver 403 Forbidden)
```bash
curl -i "http://localhost:8080/..%2f..%2fconfig.json"
```

---

## Estructura del Proyecto

```text
web-server/
├── auth.js               # Middleware de HTTP Basic Auth (RFC 7617)
├── config.json           # Configuración del servidor (puerto, rutas, credenciales)
├── DOCUMENTATION.md      # Documentación técnica completa y exhaustiva
├── logger.js             # Módulo de auditoría de accesos (consola y archivo)
├── logs/
│   └── access.log        # Registro cronológico de peticiones HTTP
├── package.json          # Metadatos del proyecto y scripts de ejecución
├── public/               # DocumentRoot del servidor
│   ├── admin/
│   │   └── index.html    # Panel de control web y visor de logs en vivo
│   ├── index.html        # Página de bienvenida con suite de pruebas
│   └── protected/
│       └── index.html    # Recurso protegido por credenciales
├── README.md             # Guía de inicio y resumen
├── security.js           # Sandbox de DocumentRoot y anti Directory Traversal
└── server.js             # Punto de entrada y despachador HTTP
```
