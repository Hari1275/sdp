# Mobile Developer Quick Start Guide
## SDP Ayurveda Dashboard API Integration

**Get started in 5 minutes** 🚀

---

## 📋 Prerequisites

- Mobile development environment (React Native, Flutter, Native iOS/Android)
- API testing tool (Postman, curl, or similar)
- Basic understanding of REST APIs and JSON

---

## 🚀 Quick Setup

### 1. Test the API Connection

```bash
# Test the API is running
curl -X GET http://localhost:3000/api/health

# Expected response:
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

### 2. Verify CORS is Working

```bash
# Test cross-origin request
curl -X GET \
  -H "Origin: http://your-mobile-app-domain.com" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/health

# Should return same response with CORS headers
```

---

## 🔑 Authentication Setup

The API uses NextAuth.js with JWT tokens. Here's how to authenticate:

### Step 1: Login Process

```javascript
// For web-based authentication, redirect to:
const loginUrl = 'http://localhost:3000/api/auth/signin';

// For mobile apps, you'll need to implement a custom flow
// The API uses session-based authentication primarily
```

### Step 2: Get Current User Info

```javascript
// Once authenticated, get user profile
fetch('http://localhost:3000/api/auth/me', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // Include session cookies or JWT token
  },
  credentials: 'include' // Important for session cookies
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Current user:', data.data.user);
    console.log('Role:', data.data.user.role); // ADMIN, LEAD_MR, or MR
  }
});
```

---

## 📊 Basic API Usage Examples

### Get All Clients (with pagination)

```javascript
async function getClients(page = 1, limit = 10) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/clients?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Clients:', data.data);
      console.log('Pagination:', data.pagination);
      return data;
    } else {
      console.error('Error:', data.message);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

// Usage
getClients(1, 20).then(result => {
  // Handle clients data
});
```

### Create a New Business Entry

```javascript
async function createBusinessEntry(clientId, amount, notes, gpsCoords) {
  try {
    const response = await fetch('http://localhost:3000/api/business', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        clientId: clientId,
        amount: amount,
        notes: notes,
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Business entry created:', data.data);
      return data.data;
    } else {
      console.error('Failed to create entry:', data.message);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

// Usage with GPS
navigator.geolocation.getCurrentPosition(
  position => {
    const gpsCoords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
    
    createBusinessEntry('client-id-123', 1500.50, 'Monthly order', gpsCoords);
  },
  error => console.error('GPS error:', error)
);
```

### Get User's Tasks

```javascript
async function getTasks(status = null) {
  try {
    const url = status 
      ? `http://localhost:3000/api/tasks?status=${status}`
      : 'http://localhost:3000/api/tasks';
      
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Tasks:', data.data);
      return data.data;
    } else {
      console.error('Error:', data.message);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

// Get pending tasks
getTasks('PENDING');
```

---

## 🏗️ API Client Class Template

Here's a reusable API client class:

```javascript
class SDPApiClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include',
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // User methods
  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/users?${query}`);
  }

  // Client methods
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

  async getClient(id) {
    return this.request(`/api/clients/${id}`);
  }

  // Business entry methods
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

  // Task methods
  async getTasks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/tasks?${query}`);
  }

  async completeTask(taskId, notes) {
    return this.request(`/api/tasks/${taskId}/complete`, {
      method: 'PUT',
      body: JSON.stringify({ notes })
    });
  }

  // Geographic data
  async getRegions() {
    return this.request('/api/regions');
  }

  async getAreas(regionId = null) {
    const params = regionId ? `?regionId=${regionId}` : '';
    return this.request(`/api/areas${params}`);
  }
}

// Usage
const apiClient = new SDPApiClient();

// Example usage
async function loadDashboardData() {
  try {
    const [user, clients, tasks] = await Promise.all([
      apiClient.getCurrentUser(),
      apiClient.getClients({ limit: 20 }),
      apiClient.getTasks({ status: 'PENDING' })
    ]);

    console.log('Dashboard data loaded:', { user, clients, tasks });
  } catch (error) {
    console.error('Failed to load dashboard:', error);
  }
}
```

---

## 🔧 Error Handling

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message"
}
```

### Common Error Codes
- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Invalid input data
- `RATE_LIMIT_EXCEEDED` (429): Too many requests

### Error Handling Example
```javascript
async function handleApiCall(apiFunction) {
  try {
    const result = await apiFunction();
    return result;
  } catch (error) {
    switch (error.message) {
      case 'UNAUTHORIZED':
        // Redirect to login
        window.location.href = '/login';
        break;
      case 'RATE_LIMIT_EXCEEDED':
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 5000));
        return handleApiCall(apiFunction);
      default:
        // Show error to user
        alert(`Error: ${error.message}`);
    }
  }
}
```

---

## 📱 Platform-Specific Examples

### React Native
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class ReactNativeApiClient extends SDPApiClient {
  constructor(baseUrl) {
    super(baseUrl);
    this.token = null;
  }

  async getStoredToken() {
    if (!this.token) {
      this.token = await AsyncStorage.getItem('auth_token');
    }
    return this.token;
  }

  async request(endpoint, options = {}) {
    const token = await this.getStoredToken();
    
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      };
    }

    return super.request(endpoint, options);
  }
}
```

### Flutter/Dart
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class SDPApiClient {
  final String baseUrl;
  String? authToken;

  SDPApiClient(this.baseUrl);

  Future<Map<String, dynamic>> request(
    String endpoint, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    if (authToken != null) {
      headers['Authorization'] = 'Bearer $authToken';
    }

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
      // Add other methods as needed
      default:
        throw Exception('Unsupported method: $method');
    }

    final Map<String, dynamic> data = jsonDecode(response.body);
    
    if (!data['success']) {
      throw Exception(data['message'] ?? 'API request failed');
    }

    return data;
  }

  Future<Map<String, dynamic>> getCurrentUser() {
    return request('/api/auth/me');
  }

  Future<Map<String, dynamic>> getClients({Map<String, String>? params}) {
    final query = params != null ? '?' + Uri(queryParameters: params).query : '';
    return request('/api/clients$query');
  }
}
```

---

## 🧪 Testing Your Integration

### 1. Test Connection
```javascript
// Test basic connectivity
apiClient.request('/api/health')
  .then(response => console.log('API is working!', response))
  .catch(error => console.error('API connection failed:', error));
```

### 2. Test Authentication
```javascript
// Test authentication
apiClient.getCurrentUser()
  .then(response => console.log('Authenticated user:', response.data.user))
  .catch(error => console.error('Authentication failed:', error));
```

### 3. Test CRUD Operations
```javascript
// Test creating and fetching data
async function testCrudOperations() {
  try {
    // Create a client (if you have permission)
    const newClient = await apiClient.createClient({
      name: 'Test Pharmacy',
      phone: '+1234567890',
      businessType: 'PHARMACY',
      address: '123 Test St',
      latitude: 40.7128,
      longitude: -74.0060
    });
    
    console.log('Client created:', newClient);
    
    // Fetch clients
    const clients = await apiClient.getClients({ limit: 5 });
    console.log('Clients fetched:', clients);
    
  } catch (error) {
    console.error('CRUD test failed:', error);
  }
}
```

---

## ⚠️ Important Notes

1. **Authentication**: The API uses session-based authentication. For mobile apps, you may need to implement a custom authentication flow.

2. **CORS**: Already configured for cross-origin requests. No additional setup needed.

3. **Rate Limiting**: 100 requests per 15 minutes per IP. Implement retry logic with exponential backoff.

4. **GPS Data**: Always include latitude and longitude for business entries.

5. **Role-based Access**: Different user roles (MR, LEAD_MR, ADMIN) have different permissions.

---

## 🚀 Ready to Start?

1. **Copy the API client code** above
2. **Test the connection** with `/api/health`
3. **Implement authentication** for your platform
4. **Start with basic data fetching** (clients, tasks)
5. **Add GPS integration** for business entries
6. **Implement offline support** (recommended)

---

## 📚 Full Documentation

- **Complete API Documentation**: `API_DOCUMENTATION.md`
- **Verification Summary**: `API_VERIFICATION_SUMMARY.md`
- **Testing Script**: `test-api-endpoints.js`

---

**Happy coding! 🎉**

*Need help? Check the troubleshooting section in the full API documentation.*
