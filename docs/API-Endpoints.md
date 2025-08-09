### API Endpoints — Frontend Quick Reference

- Base path: `/api`
- Auth: Web uses session cookies (NextAuth). Mobile uses `Authorization: Bearer <JWT>`.
- IDs are strings. Dates are ISO strings unless stated.

Auth

- [GET, POST] `/api/auth/[...nextauth]`
  - NextAuth internal (web login/logout/callback)
- [GET] `/api/auth/me`
  - Returns current user (via cookie session or JWT)
- [POST] `/api/auth/mobile/login`
  - Body: `{ username: string, password: string }`
  - Returns: `{ token: string, tokenType: 'Bearer', expiresIn: number, user: {...} }`
  - Example:
    ```json
    { "username": "john", "password": "secret" }
    ```
- [POST] `/api/auth/mobile/logout`
  - Header: `Authorization: Bearer <JWT>` (optional)
  - Body: none
- [POST] `/api/auth/mobile/refresh`
  - Header: `Authorization: Bearer <JWT>` (expired ok)
  - Body: none; returns a fresh token

Public

- [GET] `/api/public/regions`
- [GET] `/api/public/areas`
- [GET] `/api/public/users`
  - Query: `role?`

Regions

- [GET] `/api/regions`
  - Query: `page?`, `limit?`, `search?`
- [POST] `/api/regions`
  - Body: `{ name: string, description?: string, status?: 'ACTIVE'|'INACTIVE' }`
- [GET] `/api/regions/[id]`
- [PUT] `/api/regions/[id]`
  - Body: any of `{ name?, description?, status?: 'ACTIVE'|'INACTIVE' }`
- [DELETE] `/api/regions/[id]`

Areas

- [GET] `/api/areas`
  - Query: `page?`, `limit?`, `search?`, `regionId?`
- [POST] `/api/areas`
  - Body: `{ name: string, regionId: string, description?: string, status?: 'ACTIVE'|'INACTIVE' }`
- [GET] `/api/areas/[id]`
- [PUT] `/api/areas/[id]`
  - Body: any of `{ name?, description?, regionId?, status?: 'ACTIVE'|'INACTIVE' }`
- [DELETE] `/api/areas/[id]`

Clients

- [GET] `/api/clients`
  - Query: `page?`, `limit?`, `search?`, `regionId? (admin)`, `businessType?`, `areaId?`, `mrId? (admin)`
- [POST] `/api/clients`
  - Body: `{ name: string, phone?: '##########', businessType: BusinessType, areaId: string, regionId: string, latitude: number, longitude: number, address?: string, notes?: string, mrId: string }`
  - Example:
    ```json
    {
      "name": "City Clinic",
      "businessType": "CLINIC",
      "areaId": "area123",
      "regionId": "reg123",
      "latitude": 12.9716,
      "longitude": 77.5946,
      "mrId": "user_mr_1"
    }
    ```
- [GET] `/api/clients/[id]`
- [PUT] `/api/clients/[id]`
  - Body: any of client fields except `latitude`, `longitude`, `mrId`
- [DELETE] `/api/clients/[id]`
- [GET] `/api/clients/[id]/business`
  - Query: `page?`, `limit?`, `dateFrom?`, `dateTo?`
- [GET] `/api/clients/search`
  - Query: `page?`, `limit?`, `search?`, `businessType?`, `regionId? (admin)`, `areaId?`, `mrId? (admin)`, `latitude?`, `longitude?`, `radius? (km, default 10)`
- [GET] `/api/clients/statistics`
  - Query: `regionId?`, `areaId?`, `dateFrom?`, `dateTo?`
- [POST] `/api/clients/export`
  - Body: `{ format?: 'csv'|'excel', filters?: { regionId?, areaId?, businessType?, mrId?, search?, dateFrom?, dateTo? }, fields?: string[] }`
  - Returns CSV (download) or JSON (when `excel`)

Business

- [GET] `/api/business`
  - Query: `page?`, `limit?`, `clientId?`, `mrId? (admin)`, `dateFrom?`, `dateTo?`
- [POST] `/api/business`
  - Body: `{ amount: number, notes?: string, clientId: string, latitude: number, longitude: number }`
  - Example:
    ```json
    {
      "amount": 2500,
      "clientId": "client123",
      "latitude": 12.9,
      "longitude": 77.5
    }
    ```
- [GET] `/api/business/client/[clientId]`
  - Query: `page?`, `limit?`, `dateFrom?`, `dateTo?`

Users

- [GET] `/api/users`
  - Query: `page?`, `limit?`, `role?`, `status?`, `regionId?`, `leadMrId?`, `search?`
- [POST] `/api/users`
  - Body: `{ username: string, email?: string, password: string, name: string, phone?: '##########', role?: UserRole, regionId?: string, leadMrId?: string }`
- [GET] `/api/users/[id]`
- [PUT] `/api/users/[id]`
  - Body: partial of user fields (no `password`)
- [DELETE] `/api/users/[id]` (soft-deactivate)
- [GET] `/api/users/[id]/team` (Lead MR only)

Tasks

- [GET] `/api/tasks`
  - Query: `page?`, `limit?`, `status?`, `assignedTo? (admin)`, `regionId?`, `areaId?`, `priority?`, `createdById?`
- [POST] `/api/tasks`
  - Body: `{ title: string, description?: string, regionId: string, areaId?: string, assigneeId: string, priority?: Priority, dueDate?: ISOString }`
  - Example:
    ```json
    {
      "title": "Visit Clinic A",
      "regionId": "reg123",
      "assigneeId": "user_mr_1",
      "priority": "HIGH"
    }
    ```
- [GET] `/api/tasks/[id]`
- [PUT] `/api/tasks/[id]`
  - Body: partial of task fields; cannot set `status: COMPLETED` here
- [DELETE] `/api/tasks/[id]`
- [PUT|POST] `/api/tasks/[id]/complete`
  - Body (optional): `{ notes?: string }`

Tracking — Check-in/Out & Coordinates

- [POST] `/api/tracking/checkin`
  - Body: `{ checkIn?: ISOString, latitude?: number, longitude?: number, accuracy?: number }`
  - Returns: `{ sessionId, checkIn, status: 'active' }`
- [GET] `/api/tracking/checkin` — current session status
- [POST] `/api/tracking/checkout`
  - Body: `{ sessionId: string, checkOut?: ISOString, latitude?: number, longitude?: number, accuracy?: number }`
  - Returns: `{ sessionId, checkOut, totalKm, duration, avgSpeed, ... }`
- [PATCH] `/api/tracking/checkout`
  - Body: `{ sessionId: string, reason?: string }` (force close)
- [POST] `/api/tracking/coordinates`
  - Body: `{ sessionId: string, coordinates: Array<{ latitude: number, longitude: number, timestamp?: ISOString, accuracy?: number, speed?: number, altitude?: number }> }`
- [GET] `/api/tracking/coordinates`
  - Query: `sessionId` (required), `startTime?`, `endTime?`, `limit?`, `offset?`
- [POST] `/api/tracking/coordinates/batch`
  - Body: `{ sessionId: string, coordinates: Array<...same as above>, syncToken?: string }` (max 5000 coords)
- [GET] `/api/tracking/coordinates/batch`
  - Query: `sessionId`

Tracking — Analytics

- [GET] `/api/tracking/analytics/daily`
  - Query: `userId?`, `date? (YYYY-MM-DD)`, `region?`
- [GET] `/api/tracking/analytics/weekly`
  - Query: `userId?`, `weekStart? (YYYY-MM-DD)`, `region?`
- [GET] `/api/tracking/analytics/monthly`
  - Query: `userId?`, `month? (1-12)`, `year?`, `region?`

Tracking — Sessions & Live

- [GET] `/api/tracking/sessions`
  - Query: `userId?`, `dateFrom?`, `dateTo?`, `status? (active|completed)`, `limit?`, `offset?`, `includeLogs?`
- [POST] `/api/tracking/sessions` (admin)
  - Body: `{ userId: string, checkIn: ISOString, checkOut?: ISOString, startLat?: number, startLng?: number, endLat?: number, endLng?: number, totalKm?: number, notes?: string }`
- [GET] `/api/tracking/sessions/[id]`
  - Query: `includeRoute?`, `includeAnalytics?`
- [PATCH] `/api/tracking/sessions/[id]`
  - Body: any of `{ totalKm?, checkOut?, endLat?, endLng? }`
- [DELETE] `/api/tracking/sessions/[id]` (admin)
- [GET] `/api/tracking/live`
  - Query: `userId?`, `includeTeam?=true|false`, `region?`

Utilities / Debug

- [GET] `/api/health`
- [GET] `/api/db-test`
- [GET] `/api/debug/admin-user`
- [GET] `/api/debug/clients`
- [POST, GET] `/api/seed` (dev only)

Enums

- BusinessType: `CLINIC | MEDICAL_STORE | HOSPITAL | PHARMACY | HEALTHCARE_CENTER`
- Priority: `LOW | MEDIUM | HIGH | URGENT`
- TaskStatus (read-only here): `PENDING | IN_PROGRESS | COMPLETED | CANCELLED`
- UserRole: `MR | LEAD_MR | ADMIN`
