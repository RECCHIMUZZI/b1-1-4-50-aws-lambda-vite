# Proyecto: Lista de tareas (Lambda + DynamoDB + Vite)

Aplicación de lista de tareas (to-do list) con backend serverless en AWS (Lambda +
DynamoDB, desplegado con Terraform) y frontend en Vite (React + TypeScript),
publicado en GitHub y Vercel.

## 1. Infraestructura (Terraform)

- Región AWS: `us-east-1`.
- Provider `aws` configurado con el profile de AWS CLI `prf-aws-2026`
  (`profile = "prf-aws-2026"` en el bloque `provider "aws"`, o vía
  `AWS_PROFILE=prf-aws-2026` al ejecutar Terraform), sin credenciales
  hardcodeadas en el código.

### 1.1 DynamoDB

- Tabla `tasks` con modelo:
  - `id` (String, PK) — UUID generado al crear la tarea.
  - `title` (String) — texto de la tarea.
  - `completed` (Boolean) — estado de completado, `false` por defecto.
  - `createdAt` (String, ISO 8601).
  - `updatedAt` (String, ISO 8601).
- Billing mode: `PAY_PER_REQUEST` (on-demand, sin necesidad de aprovisionar
  capacidad).

### 1.2 Lambda

- Runtime: **Python 3.12**.
- Handler único que enruta las operaciones CRUD según método HTTP y path
  (ver sección 2).
- Rol IAM con permisos mínimos necesarios sobre la tabla DynamoDB
  (`GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Scan`) — no usar
  `AmazonDynamoDBFullAccess`.
- Exposición pública mediante **Lambda Function URL** con
  `authorization_type = "NONE"` (sin API Gateway).
- Resource-based policy con dos permisos (requerido desde oct. 2025):
  `lambda:InvokeFunctionUrl` (condición `FunctionUrlAuthType = NONE`) y
  `lambda:InvokeFunction` (condición `InvokedViaFunctionUrl = true`),
  ambos con `principal = "*"`. Sin el segundo permiso, la Function URL
  responde `403 Forbidden` aunque el primero esté presente. Requiere
  provider `hashicorp/aws` `~> 6.0` (el atributo
  `invoked_via_function_url` no existe en la serie 5.x).
- CORS configurado en la Function URL para permitir peticiones desde el
  dominio de Vercel (y `localhost` en desarrollo). `allow_methods` debe
  usar el wildcard `"*"` (no listar métodos como `OPTIONS`, ya que la API
  de Function URLs limita cada método a 6 caracteres).
- El CORS se gestiona **únicamente** en la configuración de la Function
  URL (bloque `cors` de Terraform); el código de la Lambda no debe añadir
  sus propios headers `Access-Control-Allow-*`. Si ambos los añaden, la
  respuesta llega con el header `Access-Control-Allow-Origin` duplicado y
  el navegador la rechaza con `Failed to fetch` (visible solo desde un
  fetch real del navegador, `curl` no lo detecta).
- Variable de entorno `TABLE_NAME` con el nombre de la tabla DynamoDB.

### 1.3 Outputs de Terraform

- URL pública de la Lambda (Function URL).
- Nombre de la tabla DynamoDB.

## 2. API (contrato)

CRUD completo sobre el recurso `tasks`:

| Método | Path         | Descripción                                  |
|--------|--------------|-----------------------------------------------|
| GET    | `/tasks`     | Lista todas las tareas.                       |
| GET    | `/tasks/{id}`| Obtiene una tarea por id.                     |
| POST   | `/tasks`     | Crea una tarea. Body: `{ "title": string }`.  |
| PUT    | `/tasks/{id}`| Actualiza una tarea (título y/o `completed`). |
| DELETE | `/tasks/{id}`| Elimina una tarea.                            |

- Respuestas en JSON, con headers `Content-Type: application/json` y CORS.
- Códigos de estado: `200` (éxito), `201` (creación), `404` (no encontrada),
  `400` (validación, p. ej. `title` vacío).

## 3. Testing

- Ejecutar `terraform apply -auto-approve` para desplegar la infraestructura.
- Probar el funcionamiento de la Lambda contra la Function URL real:
  - Crear una tarea (`POST /tasks`).
  - Listarla (`GET /tasks`).
  - Actualizarla, incluyendo marcarla como completada (`PUT /tasks/{id}`).
  - Eliminarla (`DELETE /tasks/{id}`).
  - Confirmar que `GET /tasks/{id}` devuelve `404` tras el borrado.
- Documentar los resultados (comandos `curl` o similar y respuestas
  obtenidas) como evidencia de que el sistema funciona de punta a punta.

## 4. Frontend (Vite)

- Stack: **Vite + React + TypeScript**.
- Web profesional (UI cuidada, responsive) que consume la API de la Lambda.
- Funcionalidad:
  - Listar las tareas existentes.
  - Crear una nueva tarea.
  - Marcar/desmarcar una tarea como completada.
  - Editar el título de una tarea.
  - Eliminar una tarea.
  - Manejo de estados de carga y error en las llamadas al API.
- La URL base de la API se configura vía variable de entorno
  (`VITE_API_URL`), apuntando a la Function URL de la Lambda.

## 5. Despliegue del frontend

- Subir el código de la web a un **repositorio nuevo de GitHub** (público).
- Desplegar el proyecto en **Vercel**, conectado a ese repositorio, con la
  variable de entorno `VITE_API_URL` configurada en Vercel apuntando a la
  Lambda Function URL desplegada por Terraform.

## 6. Estado desplegado (referencia)

- Repositorio: https://github.com/RECCHIMUZZI/b1-1-4-50-aws-lambda-vite
  (monorepo: `terraform/`, `lambda/`, `web/`).
- Lambda Function URL: `https://bzcihi66apg3s6o5dfistz5h6m0jjsut.lambda-url.us-east-1.on.aws`
- Tabla DynamoDB: `todo-app-tasks` (región `us-east-1`).
- Web en producción: https://todo-app-lambda-vite.vercel.app
- Proyecto Vercel: `miseia/todo-app-lambda-vite`, con `VITE_API_URL`
  configurada en los entornos Production y Preview.
