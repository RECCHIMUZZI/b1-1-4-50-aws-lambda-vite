# PLAN.md — Lista de tareas (Lambda + DynamoDB + Vite)

Bitácora completa del proyecto: decisiones tomadas, plan de implementación,
problemas encontrados y estado final desplegado. La especificación original
está en [`PROMPT.md`](./PROMPT.md); el detalle de uso está en
[`README.md`](./README.md).

## 1. Objetivo

Construir y desplegar una aplicación de lista de tareas (to-do list)
completa:
1. Backend serverless en AWS (Lambda + DynamoDB) gestionado con Terraform.
2. Frontend web profesional en Vite que consume ese backend.
3. Todo publicado y verificado end-to-end (GitHub + Vercel).

## 2. Decisiones de diseño

Estas decisiones se tomaron explícitamente con el usuario antes de
implementar, para no asumir nada no especificado en `PROMPT.md`:

| Decisión | Elegido | Alternativa descartada |
|---|---|---|
| Runtime Lambda | Python 3.12 | Node.js 20.x |
| Frontend | React + TypeScript (Vite) | Vue 3, vanilla TS |
| Alcance de la API | CRUD completo (`GET`/`POST`/`PUT`/`DELETE`) | Solo crear/listar/completar/eliminar |
| Exposición de la Lambda | Function URL (`authorization_type = NONE`) | API Gateway HTTP API |
| Región AWS | `us-east-1` | `eu-west-1` |
| Profile AWS | `prf-aws-2026` | — (pedido explícito del usuario) |
| Repositorio | Monorepo (`terraform/` + `lambda/` + `web/`) | Repo separado solo para `web/` |
| Nombre del repo | `b1-1-4-50-aws-lambda-vite` | `todo-app-lambda-vite` |
| Login Vercel | CLI + login interactivo por navegador (device flow) | Conexión manual desde el dashboard |

Diseño visual del frontend: se usó la skill `frontend-design` para evitar
un look genérico. Dirección elegida: estética de "libreta/ledger" (papel
cálido `#FAF5E6`, tipografía serif `Source Serif 4` solo en el título,
`Inter` para UI, `IBM Plex Mono` para metadatos/contadores, una regla
vertical roja tipo margen de libreta legal, y como elemento de firma un
checkbox que dibuja el check con una animación de `stroke-dashoffset`).
Justificación: el "papel/checklist" es el propio material del dominio
(una lista de tareas), no un cliché aplicado sin razón — se evitó
deliberadamente el acento terracota + serif dominante (cliché genérico de
IA) usando el rojo solo como línea estructural, no como color de acción.

## 3. Arquitectura

Ver el diagrama Mermaid en [`README.md`](./README.md#arquitectura).

Resumen: Vercel sirve la SPA estática; el navegador hace `fetch` directo
a la Lambda Function URL (sin API Gateway de por medio); la Lambda
(Python 3.12) valida la petición y hace CRUD sobre DynamoDB vía boto3;
CORS lo resuelve la propia configuración de la Function URL.

### Modelo de datos (DynamoDB, tabla `todo-app-tasks`)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | String (PK) | UUID v4 |
| `title` | String | Texto de la tarea |
| `completed` | Boolean | Estado |
| `createdAt` | String (ISO 8601) | Fecha de creación |
| `updatedAt` | String (ISO 8601) | Última modificación |

### Contrato de API

| Método | Path | Descripción |
|---|---|---|
| GET | `/tasks` | Lista todas las tareas |
| GET | `/tasks/{id}` | Obtiene una tarea |
| POST | `/tasks` | Crea (`{ "title": string }`) |
| PUT | `/tasks/{id}` | Actualiza `title` y/o `completed` |
| DELETE | `/tasks/{id}` | Elimina |

## 4. Plan de implementación (orden ejecutado)

1. **Lambda Python** (`lambda/handler.py`) — router único por
   `method` + `path`, validaciones de entrada, respuestas JSON con código
   de estado correcto (`200/201/400/404`).
2. **Terraform** (`terraform/`) — `main.tf`, `variables.tf`, `outputs.tf`:
   DynamoDB, rol IAM + policy mínima, empaquetado del zip de la Lambda vía
   `data.archive_file`, Lambda, Function URL, permisos de invocación
   pública.
3. **`terraform apply -auto-approve`** contra AWS real (profile
   `prf-aws-2026`, `us-east-1`) — confirmado explícitamente con el
   usuario antes de crear recursos reales.
4. **Pruebas CRUD end-to-end** contra la Function URL real con `curl`
   (crear, listar, obtener, actualizar, marcar completada, eliminar,
   confirmar `404` tras el borrado).
5. **Frontend Vite + React + TS** (`web/`) — scaffold con
   `npm create vite@latest`, componentes (`TaskForm`, `TaskList`,
   `TaskItem`), módulo `api.ts` con `fetch` tipado, manejo de estados de
   carga/error, diseño visual propio (ver §2).
6. **Verificación visual** con Playwright (headless Chromium) contra el
   dev server local: crear, completar, editar (doble clic), filtrar,
   eliminar — capturas de pantalla revisadas manualmente, sin errores de
   consola.
7. **Publicación en GitHub** — `git init`, commit inicial, `gh repo create
   --public --source=. --push`.
8. **Despliegue en Vercel** — `npx vercel login` (device flow, autorizado
   por el usuario en el navegador), `vercel link`, variables de entorno
   `VITE_API_URL` en Production y Preview, `vercel --prod` (confirmado
   explícitamente con el usuario por ser una acción de despliegue
   público).
9. **Verificación end-to-end en producción** — mismo test de Playwright
   apuntando a la URL real de Vercel, confirmando que el frontend
   desplegado habla correctamente con la Lambda real.
10. **Documentación** — `PROMPT.md` actualizado con cada hallazgo técnico
    en el momento en que ocurrió; este `PLAN.md` y el `README.md`
    consolidan todo al final.

## 5. Problemas encontrados y solución ("gotchas")

Dos problemas no evidentes aparecieron durante el despliegue real; ambos
quedaron corregidos en el código y documentados aquí para no repetirlos:

### 5.1 `403 Forbidden` en la Function URL pese a `authorization_type = NONE`

**Síntoma**: `curl` contra la Function URL devolvía siempre
`403 Forbidden` ("For troubleshooting Function URL authorization
issues..."), aunque la resource-based policy ya permitía
`lambda:InvokeFunctionUrl` con `principal = "*"`.

**Causa**: desde octubre de 2025, AWS exige que la resource-based policy
de la Lambda otorgue **ambos** permisos —`lambda:InvokeFunctionUrl` *y*
`lambda:InvokeFunction`— para invocaciones vía Function URL. Antes solo
hacía falta el primero.

**Fix**: se agregó un segundo `aws_lambda_permission` con
`action = "lambda:InvokeFunction"` y `invoked_via_function_url = true`.
Ese atributo no existe en el provider `hashicorp/aws` serie 5.x, así que
también se subió el constraint del provider a `~> 6.0`
(`terraform/main.tf`).

### 5.2 `Failed to fetch` en el navegador por headers CORS duplicados

**Síntoma**: `curl` mostraba respuestas perfectamente válidas (201, 200,
etc.) e incluso los registros se creaban en DynamoDB, pero el frontend
mostraba "Failed to fetch" y no reflejaba los cambios. El problema **no
era visible con `curl`**, solo con un `fetch` real desde un navegador.

**Causa**: tanto la configuración `cors` de la Function URL (Terraform)
como el propio código Python devolvían headers
`Access-Control-Allow-Origin`, resultando en el header duplicado
(`*, *`) en la respuesta HTTP. Los navegadores rechazan por spec una
respuesta CORS con ese header repetido.

**Fix**: se eliminaron los headers `Access-Control-Allow-*` del código de
`lambda/handler.py` (`RESPONSE_HEADERS` ahora solo define
`Content-Type`); el CORS lo gestiona exclusivamente el bloque `cors` de
`aws_lambda_function_url` en Terraform. También se quitó la variable de
entorno `ALLOWED_ORIGIN`, que ya no se usa.

Se detectó comparando los headers de una respuesta `OPTIONS` (preflight,
sin duplicado) contra una respuesta real `POST` (con el duplicado), y se
confirmó reproduciendo el flujo con Playwright antes y después del fix.

## 6. Testing realizado

- **Backend, vía `curl`** contra la Function URL real: create → list →
  get → update (incluye `completed: true`) → delete → get tras borrado
  (`404`). Repetido después de cada fix relevante.
- **Frontend local (dev server)**, vía Playwright headless: carga inicial,
  crear dos tareas, marcar una como completada (verificando la animación
  del checkbox), editar el título de otra vía doble clic, filtrar por
  "Completadas", volver a "Todas", eliminar una tarea. Sin errores de
  consola del navegador.
- **Producción (Vercel + Lambda real)**: mismo flujo de Playwright
  ejecutado contra `https://todo-app-lambda-vite.vercel.app`, confirmando
  que el despliegue público funciona de punta a punta.
- Después de cada corrida de pruebas se limpiaron las tareas de prueba en
  DynamoDB para dejar la tabla vacía.

## 7. Estado final desplegado

| Recurso | Valor |
|---|---|
| Repositorio GitHub | https://github.com/RECCHIMUZZI/b1-1-4-50-aws-lambda-vite |
| Web en producción (Vercel) | https://todo-app-lambda-vite.vercel.app |
| Proyecto Vercel | `miseia/todo-app-lambda-vite` |
| Lambda Function URL | https://bzcihi66apg3s6o5dfistz5h6m0jjsut.lambda-url.us-east-1.on.aws |
| Función Lambda | `todo-app-tasks-api` (Python 3.12, `us-east-1`) |
| Tabla DynamoDB | `todo-app-tasks` (`PAY_PER_REQUEST`) |
| Profile AWS usado | `prf-aws-2026` |

## 8. Posibles mejoras futuras (no implementadas, fuera de alcance actual)

- Restringir `allow_origins` de la Function URL al dominio exacto de
  Vercel en vez de `"*"`, una vez que el dominio de producción sea
  definitivo.
- Conectar el repo de GitHub al proyecto de Vercel desde el dashboard para
  obtener deploys de preview automáticos en cada PR.
- Agregar tests automatizados (unitarios para el handler de Lambda, y de
  componentes para el frontend) en vez de solo pruebas manuales/E2E.
- Mover el estado de Terraform a un backend remoto (p. ej. S3 + DynamoDB
  lock) en vez de estado local, si el proyecto crece o hay más de una
  persona operándolo.
