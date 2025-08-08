# SDP Ayurveda Dashboard API Documentation

**Version**: 1.0.0  
**Base URL**: `http://localhost:3000` (Development) | `https://your-domain.com` (Production)  
**Documentation Generated**: January 8, 2025

---

## 📚 Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [API Response Format](#api-response-format)
4. [Rate Limiting](#rate-limiting)
5. [CORS Configuration](#cors-configuration)
6. [User Management Endpoints](#user-management-endpoints)
7. [Authentication Endpoints](#authentication-endpoints)
8. [Client Management Endpoints](#client-management-endpoints)
9. [Business Entry Endpoints](#business-entry-endpoints)
10. [Task Management Endpoints](#task-management-endpoints)
11. [Geographic Data Endpoints](#geographic-data-endpoints)
12. [System Endpoints](#system-endpoints)
13. [Error Codes](#error-codes)
14. [SDKs and Code Examples](#sdks-and-code-examples)

---

## 🚀 Quick Start

### Base URLs
- **Development**: `http://localhost:3000`
- **Production**: `https://your-production-domain.com`

### Authentication
All API endpoints (except public ones) require authentication using NextAuth.js sessions or JWT tokens.

### Content Type
All API requests should use `Content-Type: application/json`

---

## 🔐 Authentication

The API uses NextAuth.js for authentication with JWT tokens and role-based access control.

### User Roles
- **ADMIN**: Full system access
- **LEAD_MR**: Regional management access
- **MR**: Field representative access

### Authentication Flow

#### 1. Login Request
```bash
POST /api/auth/signin
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

#### 2. Session Management
After successful login, authentication is handled via:
- **Session Cookies** (recommended for web applications)
- **JWT Tokens** (for mobile applications)

#### 3. Including Authentication in Requests
For mobile apps, include the session token in requests:
```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 📝 API Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Optional success message",
  "timestamp": "2025-01-08T05:22:07.621Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [
    // Array of items
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "code": "OPTIONAL_SPECIFIC_CODE"
}
```

---

## 🚦 Rate Limiting

- **Default Limit**: 100 requests per 15 minutes per IP
- **Headers Included**: 
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

### Rate Limit Response
```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "code": "429"
}
```

---

## 🌐 CORS Configuration

### Allowed Origins
- Development: `http://localhost:3000`, `http://localhost:3001`
- Production: Your configured domains

### Allowed Methods
- `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

### Allowed Headers
- `Content-Type`, `Authorization`, `X-Requested-With`

### Preflight Requests
The API handles OPTIONS preflight requests automatically.

---

## 👥 User Management Endpoints

### Get All Users
```http
GET /api/users
```

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 10, max: 100): Items per page
- `role` (string): Filter by user role (`MR`, `LEAD_MR`, `ADMIN`)
- `status` (string): Filter by status (`ACTIVE`, `INACTIVE`, `SUSPENDED`)
- `search` (string): Search by name, username, or email
- `regionId` (string): Filter by region ID (Admin only)
- `leadMrId` (string): Filter by Lead MR ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_id",
      "username": "john_doe",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "role": "MR",
      "status": "ACTIVE",
      "region": {
        "id": "region_id",
        "name": "North Region"
      },
      "leadMr": {
        "id": "lead_id",
        "name": "Lead Name"
      },
      "_count": {
        "clients": 15,
        "assignedTasks": 8,
        "createdTasks": 2,
        "teamMembers": 0
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-08T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Create New User
```http
POST /api/users
```
**Authorization**: Admin only

**Request Body:**
```json
{
  "username": "new_user",
  "password": "secure_password",
  "name": "New User Name",
  "email": "newuser@example.com",
  "phone": "+1234567890",
  "role": "MR",
  "status": "ACTIVE",
  "regionId": "region_id",
  "leadMrId": "lead_mr_id" // Optional for MR role
}
```

### Get User by ID
```http
GET /api/users/{id}
```

### Update User
```http
PUT /api/users/{id}
```
**Authorization**: Admin or self (limited fields)

### Delete User
```http
DELETE /api/users/{id}
```
**Authorization**: Admin only

### Get User's Team
```http
GET /api/users/{id}/team
```
**Authorization**: Lead MR or Admin

---

## 🔑 Authentication Endpoints

### Get Current User Profile
```http
GET /api/auth/me
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "username": "current_user",
      "name": "Current User",
      "email": "user@example.com",
      "phone": "+1234567890",
      "role": "MR",
      "status": "ACTIVE",
      "region": {
        "id": "region_id",
        "name": "North Region",
        "description": "Northern territory"
      },
      "leadMr": {
        "id": "lead_id",
        "name": "Lead Name",
        "username": "lead_user"
      },
      "teamMembers": [],
      "statistics": {
        "totalClients": 15,
        "totalBusinessEntries": 42,
        "totalAssignedTasks": 8,
        "totalGPSSessions": 156
      },
      "timestamps": {
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-08T00:00:00.000Z",
        "lastLoginAt": "2025-01-08T05:00:00.000Z"
      }
    },
    "session": {
      "expires": "2025-01-09T05:00:00.000Z"
    }
  },
  "timestamp": "2025-01-08T05:22:07.621Z"
}
```

---

## 👤 Client Management Endpoints

### Get All Clients
```http
GET /api/clients
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `search` (string): Search by client name
- `businessType` (enum): `PHARMACY`, `CLINIC`, `HOSPITAL`, `RETAIL`, `OTHER`
- `regionId` (string): Filter by region (Admin only)
- `areaId` (string): Filter by area
- `mrId` (string): Filter by MR (Admin only)

**Role-based Access:**
- **MR**: Can only see their own clients
- **LEAD_MR**: Can see region and team clients
- **ADMIN**: Can see all clients

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "client_id",
      "name": "ABC Pharmacy",
      "phone": "+1234567890",
      "businessType": "PHARMACY",
      "address": "123 Main St, City, State",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "notes": "Key client, orders monthly",
      "region": {
        "id": "region_id",
        "name": "North Region"
      },
      "area": {
        "id": "area_id",
        "name": "Downtown"
      },
      "mr": {
        "id": "mr_id",
        "name": "John Doe"
      },
      "_count": {
        "businessEntries": 12,
        "tasks": 3
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-08T00:00:00.000Z"
    }
  ],
  "pagination": { /* pagination object */ }
}
```

### Create New Client
```http
POST /api/clients
```

**Request Body:**
```json
{
  "name": "New Pharmacy",
  "phone": "+1234567890",
  "businessType": "PHARMACY",
  "address": "456 Oak St, City, State",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "notes": "New potential client",
  "areaId": "area_id",
  "regionId": "region_id", // Auto-assigned for MR users
  "mrId": "mr_id" // Auto-assigned for MR users
}
```

### Get Client by ID
```http
GET /api/clients/{id}
```

### Update Client
```http
PUT /api/clients/{id}
```

### Delete Client
```http
DELETE /api/clients/{id}
```

### Search Clients
```http
GET /api/clients/search?q={search_query}
```

---

## 💼 Business Entry Endpoints

### Get All Business Entries
```http
GET /api/business
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `clientId` (string): Filter by specific client
- `mrId` (string): Filter by MR (Admin only)
- `dateFrom` (ISO date): Start date filter
- `dateTo` (ISO date): End date filter

**Role-based Access:**
- **MR**: Can only see entries for their clients
- **LEAD_MR**: Can see region and team entries
- **ADMIN**: Can see all entries

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "entry_id",
      "amount": 1500.50,
      "notes": "Monthly order completed",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "client": {
        "id": "client_id",
        "name": "ABC Pharmacy",
        "businessType": "PHARMACY",
        "region": {
          "id": "region_id",
          "name": "North Region"
        },
        "area": {
          "id": "area_id",
          "name": "Downtown"
        },
        "mr": {
          "id": "mr_id",
          "name": "John Doe"
        }
      },
      "createdAt": "2025-01-08T10:00:00.000Z",
      "updatedAt": "2025-01-08T10:00:00.000Z"
    }
  ],
  "pagination": { /* pagination object */ }
}
```

### Create New Business Entry
```http
POST /api/business
```

**Request Body:**
```json
{
  "clientId": "client_id",
  "amount": 1500.50,
  "notes": "Monthly order completed",
  "latitude": 40.7128,  // GPS coordinates
  "longitude": -74.0060
}
```

### Get Business Entries for Client
```http
GET /api/business/client/{clientId}
```

---

## ✅ Task Management Endpoints

### Get All Tasks
```http
GET /api/tasks
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `status` (enum): `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `priority` (enum): `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- `assignedTo` (string): Filter by assignee ID (Admin only)
- `regionId` (string): Filter by region
- `areaId` (string): Filter by area
- `createdById` (string): Filter by creator (Admin only)

**Role-based Access:**
- **MR**: Can only see tasks assigned to them
- **LEAD_MR**: Can see region and team tasks
- **ADMIN**: Can see all tasks

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "task_id",
      "title": "Visit new pharmacy",
      "description": "Initial consultation with ABC Pharmacy",
      "status": "PENDING",
      "priority": "HIGH",
      "dueDate": "2025-01-15T00:00:00.000Z",
      "completedAt": null,
      "region": {
        "id": "region_id",
        "name": "North Region"
      },
      "area": {
        "id": "area_id",
        "name": "Downtown"
      },
      "assignee": {
        "id": "assignee_id",
        "name": "John Doe",
        "username": "john_doe"
      },
      "createdBy": {
        "id": "creator_id",
        "name": "Lead Name",
        "username": "lead_user"
      },
      "createdAt": "2025-01-08T00:00:00.000Z",
      "updatedAt": "2025-01-08T00:00:00.000Z"
    }
  ],
  "pagination": { /* pagination object */ }
}
```

### Create New Task
```http
POST /api/tasks
```
**Authorization**: Lead MR and Admin only

**Request Body:**
```json
{
  "title": "Visit new pharmacy",
  "description": "Initial consultation with ABC Pharmacy",
  "assigneeId": "user_id",
  "priority": "HIGH",
  "dueDate": "2025-01-15T00:00:00.000Z",
  "regionId": "region_id",
  "areaId": "area_id"
}
```

### Get Task by ID
```http
GET /api/tasks/{id}
```

### Update Task
```http
PUT /api/tasks/{id}
```

### Delete Task
```http
DELETE /api/tasks/{id}
```

### Complete Task
```http
PUT /api/tasks/{id}/complete
POST /api/tasks/{id}/complete
```

**Request Body:**
```json
{
  "notes": "Task completed successfully",
  "completionData": {
    // Any additional completion data
  }
}
```

---

## 🗺️ Geographic Data Endpoints

### Get All Regions
```http
GET /api/regions
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "region_id",
      "name": "North Region",
      "description": "Northern territory coverage",
      "_count": {
        "areas": 12,
        "users": 8,
        "clients": 45
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-08T00:00:00.000Z"
    }
  ]
}
```

### Create New Region
```http
POST /api/regions
```
**Authorization**: Admin only

**Request Body:**
```json
{
  "name": "New Region",
  "description": "Description of the region"
}
```

### Get All Areas
```http
GET /api/areas
```

**Query Parameters:**
- `regionId` (string): Filter by region

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "area_id",
      "name": "Downtown",
      "regionId": "region_id",
      "region": {
        "id": "region_id",
        "name": "North Region"
      },
      "_count": {
        "clients": 15,
        "tasks": 8
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-08T00:00:00.000Z"
    }
  ]
}
```

### Create New Area
```http
POST /api/areas
```
**Authorization**: Admin only

**Request Body:**
```json
{
  "name": "New Area",
  "regionId": "region_id"
}
```

---

## 🔧 System Endpoints

### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "message": "SDP Ayurveda API is healthy",
  "data": {
    "timestamp": "2025-01-08T05:22:07.621Z",
    "version": "1.0.0",
    "database": "connected",
    "environment": "development"
  }
}
```

### Database Test
```http
GET /api/db-test
```

**Response:**
```json
{
  "success": true,
  "message": "Database connection successful",
  "data": {
    "connectionTime": "45ms",
    "databaseName": "sdp_ayurveda",
    "tablesCount": 12
  }
}
```

---

## ⚠️ Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `USER_EXISTS` | 409 | Username/email already exists |
| `CLIENT_NOT_FOUND` | 404 | Client not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `INVALID_REGION` | 400 | Invalid region specified |
| `INVALID_LEAD_MR` | 400 | Invalid Lead MR specified |

---

## 💻 SDKs and Code Examples

### JavaScript/TypeScript Example

```javascript
// API Client Class
class SDPApiClient {
  constructor(baseUrl, token = null) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  // Authentication
  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  // Users
  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/users?${query}`);
  }

  async createUser(userData) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  // Clients
  async getClients(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/clients?${query}`);
  }

  async createClient(clientData) {
    return this.request('/api/clients', {
      method: 'POST',
      body: JSON.stringify(clientData)
    });
  }

  // Business Entries
  async getBusinessEntries(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/business?${query}`);
  }

  async createBusinessEntry(entryData) {
    return this.request('/api/business', {
      method: 'POST',
      body: JSON.stringify(entryData)
    });
  }

  // Tasks
  async getTasks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/tasks?${query}`);
  }

  async createTask(taskData) {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  }

  async completeTask(taskId, completionData) {
    return this.request(`/api/tasks/${taskId}/complete`, {
      method: 'PUT',
      body: JSON.stringify(completionData)
    });
  }

  // Geographic Data
  async getRegions() {
    return this.request('/api/regions');
  }

  async getAreas(regionId = null) {
    const params = regionId ? `?regionId=${regionId}` : '';
    return this.request(`/api/areas${params}`);
  }
}

// Usage Example
const apiClient = new SDPApiClient('http://localhost:3000', 'your-jwt-token');

// Get current user
try {
  const userResponse = await apiClient.getCurrentUser();
  console.log('Current user:', userResponse.data.user);
} catch (error) {
  console.error('Error:', error.message);
}

// Get clients with pagination
try {
  const clientsResponse = await apiClient.getClients({
    page: 1,
    limit: 20,
    businessType: 'PHARMACY'
  });
  console.log('Clients:', clientsResponse.data);
  console.log('Pagination:', clientsResponse.pagination);
} catch (error) {
  console.error('Error:', error.message);
}

// Create a new business entry with GPS
try {
  const entryResponse = await apiClient.createBusinessEntry({
    clientId: 'client_id_here',
    amount: 2500.75,
    notes: 'Monthly order - increased quantity',
    latitude: 40.7128,
    longitude: -74.0060
  });
  console.log('New business entry:', entryResponse.data);
} catch (error) {
  console.error('Error:', error.message);
}
```

### React Hook Example

```javascript
// Custom hook for SDP API
import { useState, useEffect } from 'react';

export function useSDPApi(endpoint, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`/api${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          ...options
        });

        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [endpoint]);

  return { data, loading, error };
}

// Usage in React component
function ClientsList() {
  const { data: clients, loading, error } = useSDPApi('/clients?limit=50');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Clients ({clients?.pagination?.total})</h1>
      {clients?.data?.map(client => (
        <div key={client.id}>
          <h3>{client.name}</h3>
          <p>{client.businessType} - {client.address}</p>
          <p>MR: {client.mr.name}</p>
        </div>
      ))}
    </div>
  );
}
```

### Flutter/Dart Example

```dart
// SDP API Client for Flutter
import 'dart:convert';
import 'package:http/http.dart' as http;

class SDPApiClient {
  final String baseUrl;
  final String? token;

  SDPApiClient(this.baseUrl, {this.token});

  Map<String, String> get headers {
    final Map<String, String> headers = {
      'Content-Type': 'application/json',
    };
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<Map<String, dynamic>> request(
    String endpoint, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    
    http.Response response;
    
    switch (method.toUpperCase()) {
      case 'GET':
        response = await http.get(uri, headers: headers);
        break;
      case 'POST':
        response = await http.post(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case 'PUT':
        response = await http.put(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case 'DELETE':
        response = await http.delete(uri, headers: headers);
        break;
      default:
        throw Exception('Unsupported HTTP method: $method');
    }

    final Map<String, dynamic> data = jsonDecode(response.body);
    
    if (!data['success']) {
      throw Exception(data['message'] ?? 'API request failed');
    }

    return data;
  }

  // Get current user
  Future<Map<String, dynamic>> getCurrentUser() async {
    return request('/api/auth/me');
  }

  // Get clients
  Future<Map<String, dynamic>> getClients({
    int page = 1,
    int limit = 10,
    String? search,
    String? businessType,
  }) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    
    if (search != null) params['search'] = search;
    if (businessType != null) params['businessType'] = businessType;
    
    final query = Uri(queryParameters: params).query;
    return request('/api/clients?$query');
  }

  // Create business entry
  Future<Map<String, dynamic>> createBusinessEntry({
    required String clientId,
    required double amount,
    String? notes,
    double? latitude,
    double? longitude,
  }) async {
    return request(
      '/api/business',
      method: 'POST',
      body: {
        'clientId': clientId,
        'amount': amount,
        'notes': notes,
        'latitude': latitude,
        'longitude': longitude,
      },
    );
  }
}

// Usage Example
void main() async {
  final api = SDPApiClient('http://localhost:3000', token: 'your-jwt-token');
  
  try {
    // Get current user
    final userResponse = await api.getCurrentUser();
    print('Current user: ${userResponse['data']['user']['name']}');
    
    // Get clients
    final clientsResponse = await api.getClients(
      page: 1,
      limit: 20,
      businessType: 'PHARMACY',
    );
    print('Clients count: ${clientsResponse['pagination']['total']}');
    
    // Create business entry
    final entryResponse = await api.createBusinessEntry(
      clientId: 'client_id_here',
      amount: 1500.50,
      notes: 'Monthly order completed',
      latitude: 40.7128,
      longitude: -74.0060,
    );
    print('Business entry created: ${entryResponse['data']['id']}');
  } catch (e) {
    print('Error: $e');
  }
}
```

---

## 🔄 CORS Testing Commands

Test CORS functionality:

```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  http://localhost:3000/api/health

# Test actual request with CORS
curl -X GET \
  -H "Origin: http://localhost:3001" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/health
```

Expected CORS headers in response:
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`

---

## 📱 Mobile App Integration Notes

### Authentication Flow for Mobile Apps
1. **Login**: Use credentials to get JWT token
2. **Store Token**: Securely store JWT in device keychain/keystore
3. **Include Token**: Send token in Authorization header for all requests
4. **Handle Expiry**: Implement automatic token refresh logic

### GPS Integration
For business entries and location-based features:
- Always include `latitude` and `longitude` when creating business entries
- Use device GPS for accurate location tracking
- Handle location permissions appropriately

### Offline Functionality
Consider implementing:
- Local SQLite database for offline data storage
- Queue system for pending API requests
- Sync mechanism when connection is restored

### Push Notifications
For task notifications and updates:
- Implement push notification tokens
- Handle notification permissions
- Create endpoints for notification preferences (future enhancement)

---

## 📞 Support

For technical support and questions:
- **Email**: api-support@sdp-ayurveda.com
- **Documentation**: This document
- **Issue Tracking**: GitHub Issues (if applicable)

---

**Last Updated**: January 8, 2025  
**API Version**: 1.0.0  
**Documentation Version**: 1.0.0
