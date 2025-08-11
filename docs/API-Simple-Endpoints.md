### SDP Ayurveda API — Simple Endpoints Reference

- Base path: `/api`
- Auth: Web uses session cookies (NextAuth). Mobile uses `Authorization: Bearer <JWT>`.
- Response shape: Most endpoints return `{ success: boolean, data?, message?, error? }`. Some tracking endpoints return plain objects as shown below.

### Auth

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| POST | `/auth/mobile/login` | Public | `{ "username": string, "password": string }` | `{ success: true, data: { token, tokenType: "Bearer", expiresIn, user } }` |
| POST | `/auth/mobile/refresh` | JWT | — | `{ success: true, data: { token, expiresIn } }` |
| POST | `/auth/mobile/logout` | JWT | — | `{ success: true, message: "Logged out" }` |
| GET | `/auth/me` | Auth | — | `{ success: true, data: { user, session? } }` |

### Public

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| GET | `/public/regions` | Public | — | `{ regions: [...] }` |
| GET | `/public/areas` | Public | — | `{ areas: [...] }` |
| GET | `/public/users?role?` | Public | — | `{ users: [...] }` |

### Users

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| GET | `/users` | Auth | — | `{ success: true, data: [user...], pagination }` |
| POST | `/users` | Admin | `{ username, password, name, email?, phone?, role, regionId?, leadMrId? }` | `{ success: true, message, data: user }` |
| GET | `/users/[id]` | Auth | — | `{ success: true, data: user }` |
| PUT | `/users/[id]` | Admin or self (limited) | `{ ...partial user fields }` | `{ success: true, message, data: user }` |
| DELETE | `/users/[id]` | Admin | — | `{ success: true, message }` |
| GET | `/users/[id]/team` | Lead MR or Admin | — | `{ success: true, data: [user...] }` |

### Regions

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| GET | `/regions` | Auth | — | `{ success: true, data: [region...], pagination }` |
| POST | `/regions` | Admin | `{ name, description?, status?: 'ACTIVE'|'INACTIVE' }` | `{ success: true, message, data: region }` |
| GET | `/regions/[id]` | Auth | — | `{ success: true, data: region }` |
| PUT | `/regions/[id]` | Admin | `{ name?, description?, status? }` | `{ success: true, message, data: region }` |
| DELETE | `/regions/[id]` | Admin | — | `{ success: true, message }` |

### Areas

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| GET | `/areas` | Auth | — | `{ success: true, data: [area...], pagination }` |
| POST | `/areas` | Admin | `{ name, regionId, description?, status?: 'ACTIVE'|'INACTIVE' }` | `{ success: true, message, data: area }` |
| GET | `/areas/[id]` | Auth | — | `{ success: true, data: area }` |
| PUT | `/areas/[id]` | Admin | `{ name?, description?, regionId?, status? }` | `{ success: true, message, data: area }` |
| DELETE | `/areas/[id]` | Admin | — | `{ success: true, message }` |

### Clients

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| GET | `/clients` | Auth (role-based data) | — | `{ success: true, data: [client...], pagination }` |
| POST | `/clients` | MR/Lead MR/Admin | `{ name, businessType, areaId, regionId, latitude, longitude, phone?, address?, notes?, mrId? }` | `{ success: true, message, data: client }` |
| GET | `/clients/[id]` | Auth (role-based access) | — | `{ success: true, data: client }` |
| PUT | `/clients/[id]` | MR/Lead MR/Admin | `{ ...partial client fields }` | `{ success: true, message, data: client }` |
| DELETE | `/clients/[id]` | Admin | — | `{ success: true, message }` |
| GET | `/clients/[id]/business` | Auth | — | `{ success: true, data: [entry...], pagination }` |
| GET | `/clients/search` | Auth | — | `{ success: true, data: [client...], pagination }` |
| GET | `/clients/statistics` | Auth | — | `{ success: true, data: { ...stats } }` |
| POST | `/clients/export` | Auth | `{ format?: 'csv'|'excel', filters?, fields? }` | CSV download or `{ success: true, data }` |

### Business

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| GET | `/business` | Auth | — | `{ success: true, data: [entry...], pagination }` |
| POST | `/business` | Auth | `{ clientId, amount, notes?, latitude?, longitude? }` | `{ success: true, message, data: entry }` |
| GET | `/business/client/[clientId]` | Auth | — | `{ success: true, data: [entry...], pagination }` |

### Tasks

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| GET | `/tasks` | Auth (role-based data) | — | `{ success: true, data: [task...], pagination }` |
| POST | `/tasks` | Lead MR/Admin | `{ title, description?, regionId, areaId?, assigneeId, priority?, dueDate? }` | `{ success: true, message, data: task }` |
| GET | `/tasks/[id]` | Auth (role-based access) | — | `{ success: true, data: task }` |
| PUT | `/tasks/[id]` | Lead MR/Admin | `{ ...partial task fields }` | `{ success: true, message, data: task }` |
| DELETE | `/tasks/[id]` | Lead MR/Admin | — | `{ success: true, message }` |
| PUT/POST | `/tasks/[id]/complete` | Assignee/Lead MR/Admin | `{ notes? }` | `{ success: true, message, data: { task, completedBy, completionTimestamp } }` |
| PUT | `/tasks/[id]/status` | Lead MR/Admin | `{ status }` | `{ success: true, message, data: task }` |
| POST | `/tasks/[id]/assign` | Lead MR/Admin | `{ assigneeId }` | `{ success: true, message, data: task }` |
| POST | `/tasks/assign-bulk` | Lead MR/Admin | `{ taskIds: string[], assigneeId }` | `{ success: true, message, data }` |
| GET | `/tasks/notifications` | Auth | — | `{ success: true, data: [notification...] }` |
| POST | `/tasks/notifications/send` | Lead MR/Admin | `{ userId|teamId, title, body }` | `{ success: true, message }` |
| PUT | `/tasks/notifications/[id]/read` | Auth | — | `{ success: true, message }` |

### Tracking — Check-in/Out & Coordinates

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| POST | `/tracking/checkin` | Auth | `{ checkIn?, latitude?, longitude?, accuracy? }` | `{ sessionId, checkIn, status: 'active', warnings? }` |
| GET | `/tracking/checkin` | Auth | — | `{ status: 'active'|'inactive', activeSession? }` |
| POST | `/tracking/checkout` | Auth | `{ sessionId, checkOut?, latitude?, longitude?, accuracy? }` | `{ success: true, data: { sessionId, checkOut, totalKm, ... } }` |
| PATCH | `/tracking/checkout` | Auth | `{ sessionId, reason? }` | `{ success: true, message }` |
| POST | `/tracking/coordinates` | Auth | `{ sessionId, coordinates: [{ latitude, longitude, timestamp?, accuracy?, speed?, altitude? }] }` | `{ success: true, message }` |
| GET | `/tracking/coordinates?sessionId=...` | Auth | — | `{ success: true, data: { logs: [...], stats } }` |
| POST | `/tracking/coordinates/batch` | Auth | `{ sessionId, coordinates: [...], syncToken? }` | `{ success: true, message, data: { inserted, duplicates } }` |
| GET | `/tracking/coordinates/batch?sessionId=...` | Auth | — | `{ success: true, data: { recentUploads, session } }` |

### Tracking — Sessions, Live, Analytics

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| GET | `/tracking/sessions` | Auth | — | `{ success: true, data: [session...], pagination, meta }` |
| POST | `/tracking/sessions` | Admin | `{ userId, checkIn, checkOut?, startLat?, startLng?, endLat?, endLng?, totalKm?, notes? }` | `{ success: true, message, data: { sessionId, createdBy } }` |
| GET | `/tracking/sessions/[id]` | Auth (owner/admin/lead) | — | `{ ...session, route?, analytics? }` |
| PATCH | `/tracking/sessions/[id]` | Owner/Admin | `{ totalKm?, checkOut?, endLat?, endLng? }` | `{ success: true, message, data }` |
| DELETE | `/tracking/sessions/[id]` | Admin | — | `{ success: true, message }` |
| GET | `/tracking/live` | Auth | — | `{ success: true, data: [activeSessions...] }` |
| GET | `/tracking/analytics/daily` | Auth | — | `{ success: true, data: { kpis, charts } }` |
| GET | `/tracking/analytics/weekly` | Auth | — | `{ success: true, data: { kpis, charts } }` |
| GET | `/tracking/analytics/monthly` | Auth | — | `{ success: true, data: { kpis, charts } }` |

### Reports

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| GET | `/reports/overview` | Auth | — | `{ success: true, data: { kpis, trends, dateRange } }` |
| GET | `/reports/gps-tracking` | Auth | — | `{ success: true, data: { ... } }` |
| GET | `/reports/user-performance` | Auth | — | `{ success: true, data }` |
| GET | `/reports/task-completion` | Auth | — | `{ success: true, data }` |
| GET | `/reports/regional-performance` | Auth | — | `{ success: true, data }` |
| POST | `/reports/export` | Auth | `{ type, filters }` | File download or `{ success: true, data }` |

### Utilities / System

| Method | Path | Auth | Request Body | Response Example |
|---|---|---|---|---|
| GET | `/health` | Public | — | `{ success: true, message: 'SDP Ayurveda API is healthy', data: { timestamp, version, database, environment } }` |
| GET | `/db-test` | Public (dev) | — | `{ success: true, message, schemaInfo? }` |
| GET | `/debug/admin-user` | Public (dev) | — | `{ found, user?, message }` |
| GET | `/debug/clients` | Public (dev) | — | `{ clientsSample, message }` |
| POST/GET | `/seed` | Public (dev) | — | `{ success: true, message }` |

Notes

- Auth denotes who can call the endpoint: Public, Auth (any authenticated), MR, Lead MR, Admin. Many endpoints enforce role-based data access even when accessible to all authenticated users.
- For full request/response schemas and query parameters, see `docs/API-Endpoints.md` and `docs/API-Documentation.md`.


