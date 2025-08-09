### API Endpoints — Frontend Quick Reference

- Base path: `/api`

Auth

- [GET, POST] `/api/auth/[...nextauth]`
- [GET] `/api/auth/me`
- [POST, GET] `/api/auth/mobile/login`
- [POST, GET] `/api/auth/mobile/logout`
- [POST, GET] `/api/auth/mobile/refresh`

Public

- [GET] `/api/public/regions`
- [GET] `/api/public/areas`
- [GET] `/api/public/users`

Regions

- [GET, POST] `/api/regions`
- [GET, PUT, DELETE] `/api/regions/[id]`

Areas

- [GET, POST] `/api/areas`
- [GET, PUT, DELETE] `/api/areas/[id]`

Clients

- [GET, POST] `/api/clients`
- [GET, PUT, DELETE] `/api/clients/[id]`
- [GET] `/api/clients/[id]/business`
- [GET] `/api/clients/search`
- [GET] `/api/clients/statistics`
- [POST] `/api/clients/export`

Business

- [GET, POST] `/api/business`
- [GET] `/api/business/client/[clientId]`

Users

- [GET, POST] `/api/users`
- [GET, PUT, DELETE] `/api/users/[id]`
- [GET] `/api/users/[id]/team`

Tasks

- [GET, POST] `/api/tasks`
- [GET, PUT, DELETE] `/api/tasks/[id]`
- [PUT, POST] `/api/tasks/[id]/complete`

Tracking — Analytics

- [GET] `/api/tracking/analytics/daily`
- [GET] `/api/tracking/analytics/weekly`
- [GET] `/api/tracking/analytics/monthly`

Tracking — Sessions & Live

- [POST, GET] `/api/tracking/checkin`
- [POST, PATCH] `/api/tracking/checkout`
- [POST, GET] `/api/tracking/coordinates`
- [POST, GET] `/api/tracking/coordinates/batch`
- [POST, GET, PATCH] `/api/tracking/errors`
- [GET] `/api/tracking/live`
- [GET, POST] `/api/tracking/sessions`
- [GET, PATCH, DELETE] `/api/tracking/sessions/[id]`

Utilities / Debug

- [GET] `/api/health`
- [GET, POST] `/api/db-test`
- [GET] `/api/debug/admin-user`
- [GET] `/api/debug/clients`
- [POST, GET] `/api/seed`
