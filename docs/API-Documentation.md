# SDP Ayurveda Dashboard API Documentation

## Overview

This document provides comprehensive API documentation for the SDP Ayurveda Dashboard backend endpoints, specifically focusing on **Task Management** and **User Management** APIs that the frontend application will need to interact with.

## Base URL
```
http://localhost:3000/api  # Development
https://your-domain.com/api  # Production
```

## Authentication

### Session-Based Authentication (Web)
The API supports NextAuth session-based authentication for web applications using cookies.

### JWT Authentication (Mobile)
For mobile applications, use JWT tokens in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

Get JWT tokens from the mobile login endpoint: `/api/auth/mobile/login`

---

## Task Management API

### 1. Get Tasks List

**Endpoint:** `GET /api/tasks`

**Description:** Retrieve a paginated list of tasks with role-based filtering.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)
- `status` (string, optional): Filter by task status - `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `assignedTo` (string, optional): Filter by assignee ID (Admin only)
- `regionId` (string, optional): Filter by region ID
- `areaId` (string, optional): Filter by area ID
- `priority` (string, optional): Filter by priority - `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `createdById` (string, optional): Filter by creator ID (Admin only)

**Access Control:**
- **MR**: Can only see tasks assigned to them
- **Lead MR**: Can see tasks in their region, assigned to their team, created by them, or assigned to them
- **Admin**: Can see all tasks

**Example Request:**
```bash
GET /api/tasks?page=1&limit=10&status=PENDING&regionId=region-123
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "task-123",
      "title": "Visit Clinic ABC",
      "description": "Monthly checkup and inventory review",
      "status": "PENDING",
      "priority": "HIGH",
      "dueDate": "2024-01-15T10:00:00.000Z",
      "completedAt": null,
      "createdAt": "2024-01-01T08:00:00.000Z",
      "updatedAt": "2024-01-01T08:00:00.000Z",
      "region": {
        "id": "region-123",
        "name": "Mumbai"
      },
      "area": {
        "id": "area-456",
        "name": "Bandra"
      },
      "assignee": {
        "id": "user-789",
        "name": "John Doe",
        "username": "john_mr"
      },
      "createdBy": {
        "id": "user-101",
        "name": "Lead MR",
        "username": "lead_mumbai"
      }
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

### 2. Get Individual Task

**Endpoint:** `GET /api/tasks/{id}`

**Description:** Retrieve detailed information about a specific task.

**Path Parameters:**
- `id` (string, required): Task ID

**Access Control:**
- **MR**: Can only access tasks assigned to them
- **Lead MR**: Can access tasks in their region, assigned to their team, created by them, or assigned to them
- **Admin**: Can access all tasks

**Example Request:**
```bash
GET /api/tasks/task-123
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "title": "Visit Clinic ABC",
    "description": "Monthly checkup and inventory review",
    "status": "PENDING",
    "priority": "HIGH",
    "dueDate": "2024-01-15T10:00:00.000Z",
    "completedAt": null,
    "createdAt": "2024-01-01T08:00:00.000Z",
    "updatedAt": "2024-01-01T08:00:00.000Z",
    "assigneeId": "user-789",
    "createdById": "user-101",
    "regionId": "region-123",
    "region": {
      "id": "region-123",
      "name": "Mumbai"
    },
    "area": {
      "id": "area-456",
      "name": "Bandra"
    },
    "assignee": {
      "id": "user-789",
      "name": "John Doe",
      "username": "john_mr",
      "leadMrId": "user-101"
    },
    "createdBy": {
      "id": "user-101",
      "name": "Lead MR",
      "username": "lead_mumbai"
    }
  }
}
```

### 3. Create Task

**Endpoint:** `POST /api/tasks`

**Description:** Create a new task.

**Access Control:** Lead MR and Admin only

**Request Body:**
```json
{
  "title": "Visit Clinic ABC",
  "description": "Monthly checkup and inventory review",
  "regionId": "region-123",
  "areaId": "area-456",
  "assigneeId": "user-789",
  "priority": "HIGH",
  "dueDate": "2024-01-15T10:00:00.000Z"
}
```

**Request Body Fields:**
- `title` (string, required): Task title (1-200 characters)
- `description` (string, optional): Task description (max 1000 characters)
- `regionId` (string, required): Target region ID
- `areaId` (string, optional): Target area ID
- `assigneeId` (string, required): User ID to assign the task to
- `priority` (string, required): Task priority - `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `dueDate` (string, optional): ISO date string for due date

**Validation Rules:**
- Lead MR can only create tasks in their region
- Lead MR can only assign tasks to MR users in their region or team
- Area must belong to the specified region
- Assignee must exist and be active

**Example Response:**
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "task-123",
    "title": "Visit Clinic ABC",
    "description": "Monthly checkup and inventory review",
    "status": "PENDING",
    "priority": "HIGH",
    "dueDate": "2024-01-15T10:00:00.000Z",
    "completedAt": null,
    "createdAt": "2024-01-01T08:00:00.000Z",
    "updatedAt": "2024-01-01T08:00:00.000Z",
    "region": {
      "id": "region-123",
      "name": "Mumbai"
    },
    "area": {
      "id": "area-456",
      "name": "Bandra"
    },
    "assignee": {
      "id": "user-789",
      "name": "John Doe",
      "username": "john_mr"
    },
    "createdBy": {
      "id": "user-101",
      "name": "Lead MR",
      "username": "lead_mumbai"
    }
  }
}
```

### 4. Update Task

**Endpoint:** `PUT /api/tasks/{id}`

**Description:** Update task details.

**Access Control:** Lead MR and Admin only

**Path Parameters:**
- `id` (string, required): Task ID

**Request Body:** (All fields optional)
```json
{
  "title": "Updated Task Title",
  "description": "Updated description",
  "areaId": "area-789",
  "assigneeId": "user-456",
  "priority": "MEDIUM",
  "status": "IN_PROGRESS",
  "dueDate": "2024-01-20T10:00:00.000Z"
}
```

**Validation Rules:**
- Cannot update status to `COMPLETED` (use completion endpoint instead)
- Lead MR can only update tasks in their region or assigned to their team
- Same validation rules as create task apply

**Example Response:**
```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {
    // Updated task object (same structure as create response)
  }
}
```

### 5. Complete Task

**Endpoint:** `PUT /api/tasks/{id}/complete`

**Alternative:** `POST /api/tasks/{id}/complete`

**Description:** Mark a task as completed.

**Path Parameters:**
- `id` (string, required): Task ID

**Request Body:** (Optional)
```json
{
  "notes": "Task completed successfully with additional notes"
}
```

**Access Control:**
- **MR**: Can only complete tasks assigned to them
- **Lead MR**: Can complete tasks assigned to them, in their region, assigned to their team, or created by them
- **Admin**: Can complete any task

**Example Response:**
```json
{
  "success": true,
  "message": "Task marked as completed successfully",
  "data": {
    "task": {
      "id": "task-123",
      "title": "Visit Clinic ABC",
      "description": "Monthly checkup and inventory review",
      "status": "COMPLETED",
      "priority": "HIGH",
      "dueDate": "2024-01-15T10:00:00.000Z",
      "completedAt": "2024-01-12T14:30:00.000Z",
      "createdAt": "2024-01-01T08:00:00.000Z",
      "updatedAt": "2024-01-12T14:30:00.000Z",
      // ... rest of task object
    },
    "completedBy": {
      "id": "user-789",
      "name": "John Doe",
      "username": "john_mr"
    },
    "completionTimestamp": "2024-01-12T14:30:00.000Z"
  }
}
```

### 6. Delete Task

**Endpoint:** `DELETE /api/tasks/{id}`

**Description:** Delete a task.

**Access Control:** Lead MR and Admin only

**Path Parameters:**
- `id` (string, required): Task ID

**Validation Rules:**
- Lead MR can only delete tasks in their region or created by them

**Example Response:**
```json
{
  "success": true,
  "message": "Task deleted successfully",
  "data": null
}
```

---

## User Management API

### 1. Get Users List

**Endpoint:** `GET /api/users`

**Description:** Retrieve a paginated list of users with role-based filtering.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)
- `role` (string, optional): Filter by user role - `MR`, `LEAD_MR`, `ADMIN`
- `status` (string, optional): Filter by user status - `ACTIVE`, `INACTIVE`, `SUSPENDED`
- `regionId` (string, optional): Filter by region ID
- `leadMrId` (string, optional): Filter by Lead MR ID
- `search` (string, optional): Search in name, username, email

**Access Control:**
- **MR**: Can see users in their region and their Lead MR
- **Lead MR**: Can see users in their region and their team members
- **Admin**: Can see all users

**Example Request:**
```bash
GET /api/users?page=1&limit=10&role=MR&regionId=region-123&status=ACTIVE
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-123",
      "username": "john_mr",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "role": "MR",
      "status": "ACTIVE",
      "regionId": "region-123",
      "leadMrId": "user-456",
      "createdAt": "2024-01-01T08:00:00.000Z",
      "updatedAt": "2024-01-01T08:00:00.000Z",
      "region": {
        "id": "region-123",
        "name": "Mumbai"
      },
      "leadMr": {
        "id": "user-456",
        "name": "Lead MR Name"
      },
      "_count": {
        "clients": 15,
        "assignedTasks": 8,
        "createdTasks": 0,
        "teamMembers": 0
      }
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

### 2. Get Individual User

**Endpoint:** `GET /api/users/{id}`

**Description:** Retrieve detailed information about a specific user.

**Path Parameters:**
- `id` (string, required): User ID

**Access Control:** Based on role hierarchy and relationships

### 3. Create User

**Endpoint:** `POST /api/users`

**Description:** Create a new user.

**Access Control:** Admin only

**Request Body:**
```json
{
  "username": "new_user",
  "name": "New User Name",
  "email": "user@example.com",
  "phone": "9876543210",
  "password": "securePassword123",
  "role": "MR",
  "status": "ACTIVE",
  "regionId": "region-123",
  "leadMrId": "user-456"
}
```

**Request Body Fields:**
- `username` (string, required): Unique username (3-50 characters)
- `name` (string, required): Full name (2-100 characters)
- `email` (string, optional): Email address
- `phone` (string, optional): Phone number
- `password` (string, required): Password (min 8 characters)
- `role` (string, required): User role - `MR`, `LEAD_MR`, `ADMIN`
- `status` (string, optional): User status - `ACTIVE`, `INACTIVE` (default: `ACTIVE`)
- `regionId` (string, optional): Region ID
- `leadMrId` (string, optional): Lead MR ID (for MR users)

**Example Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "user-789",
    "username": "new_user",
    "name": "New User Name",
    "email": "user@example.com",
    "phone": "9876543210",
    "role": "MR",
    "status": "ACTIVE",
    "regionId": "region-123",
    "leadMrId": "user-456",
    "createdAt": "2024-01-12T10:00:00.000Z",
    "updatedAt": "2024-01-12T10:00:00.000Z",
    "region": {
      "id": "region-123",
      "name": "Mumbai"
    },
    "leadMr": {
      "id": "user-456",
      "name": "Lead MR Name"
    }
  }
}
```

### 4. Update User

**Endpoint:** `PUT /api/users/{id}`

**Description:** Update user details.

**Path Parameters:**
- `id` (string, required): User ID

**Access Control:** Admin only (with some exceptions for self-updates)

### 5. Get User Team

**Endpoint:** `GET /api/users/{id}/team`

**Description:** Get team members for a Lead MR.

**Path Parameters:**
- `id` (string, required): Lead MR User ID

**Access Control:** Lead MR can see their own team, Admin can see all teams

---

## Authentication API

### Mobile Login

**Endpoint:** `POST /api/auth/mobile/login`

**Description:** Authenticate mobile users and receive JWT token.

**Request Body:**
```json
{
  "username": "john_mr",
  "password": "password123"
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "user": {
      // User object with statistics and timestamps
    }
  }
}
```

### Token Refresh

**Endpoint:** `POST /api/auth/mobile/refresh`

**Description:** Refresh JWT token.

**Headers:**
```
Authorization: Bearer <current_token>
```

### Get Current User

**Endpoint:** `GET /api/auth/me`

**Description:** Get current authenticated user information.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      // Complete user object with statistics and relationships
    },
    "authMethod": "jwt", // or "session"
    "timestamp": "2024-01-12T14:30:00.000Z"
  }
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message"
}
```

### Common Error Codes:
- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Input validation failed
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

### Task-Specific Error Codes:
- `TASK_NOT_FOUND`: Task does not exist
- `TASK_ALREADY_COMPLETED`: Cannot modify completed task
- `ASSIGNEE_NOT_FOUND`: Invalid assignee specified
- `REGION_NOT_FOUND`: Invalid region specified
- `AREA_NOT_FOUND`: Invalid area specified

### User-Specific Error Codes:
- `USER_NOT_FOUND`: User does not exist
- `USER_EXISTS`: Username or email already exists
- `INVALID_REGION`: Invalid region specified
- `INVALID_LEAD_MR`: Invalid Lead MR specified

---

## Rate Limiting

All endpoints are rate-limited:
- **Default**: 100 requests per 15 minutes per IP
- **Login endpoints**: 10 requests per 15 minutes per IP
- **Refresh endpoints**: 20 requests per 15 minutes per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642781234
```

---

## Data Types & Enums

### TaskStatus
- `PENDING`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### Priority
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

### UserRole
- `MR`
- `LEAD_MR`
- `ADMIN`

### UserStatus
- `ACTIVE`
- `INACTIVE`
- `SUSPENDED`

### BusinessType
- `CLINIC`
- `HOSPITAL`
- `PHARMACY`
- `DISTRIBUTOR`

---

## Pagination

All list endpoints support pagination with the following query parameters:
- `page` (default: 1)
- `limit` (default: 10, max: 100)

Pagination response format:
```json
{
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

---

## Frontend Integration Examples

### React/Next.js Example

```javascript
// API client setup
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class APIClient {
  constructor() {
    this.token = localStorage.getItem('jwt_token');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  // Task methods
  async getTasks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tasks?${query}`);
  }

  async getTask(id) {
    return this.request(`/tasks/${id}`);
  }

  async createTask(taskData) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  async updateTask(id, updateData) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async completeTask(id, notes = null) {
    const body = notes ? JSON.stringify({ notes }) : '';
    return this.request(`/tasks/${id}/complete`, {
      method: 'PUT',
      body,
    });
  }

  async deleteTask(id) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // User methods
  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users?${query}`);
  }

  async createUser(userData) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Auth methods
  async login(username, password) {
    const response = await this.request('/auth/mobile/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    if (response.data.token) {
      this.token = response.data.token;
      localStorage.setItem('jwt_token', this.token);
    }
    
    return response;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async refreshToken() {
    const response = await this.request('/auth/mobile/refresh', {
      method: 'POST',
    });
    
    if (response.data.token) {
      this.token = response.data.token;
      localStorage.setItem('jwt_token', this.token);
    }
    
    return response;
  }
}

// Usage example
const apiClient = new APIClient();

// Fetch tasks
apiClient.getTasks({ page: 1, limit: 10, status: 'PENDING' })
  .then(response => {
    console.log('Tasks:', response.data);
    console.log('Pagination:', response.pagination);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
```

### React Hook Example

```javascript
import { useState, useEffect } from 'react';

function useTasks(filters = {}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getTasks(filters);
        setTasks(response.data);
        setPagination(response.pagination);
        setError(null);
      } catch (err) {
        setError(err.message);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [JSON.stringify(filters)]);

  const completeTask = async (taskId, notes) => {
    try {
      await apiClient.completeTask(taskId, notes);
      // Refresh tasks list
      const response = await apiClient.getTasks(filters);
      setTasks(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err.message);
    }
  };

  return {
    tasks,
    loading,
    error,
    pagination,
    completeTask,
  };
}

// Component usage
function TasksList() {
  const { tasks, loading, error, pagination, completeTask } = useTasks({
    page: 1,
    limit: 10,
    status: 'PENDING'
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {tasks.map(task => (
        <div key={task.id}>
          <h3>{task.title}</h3>
          <p>{task.description}</p>
          <p>Status: {task.status}</p>
          <p>Priority: {task.priority}</p>
          {task.status === 'PENDING' && (
            <button onClick={() => completeTask(task.id, 'Completed via web app')}>
              Complete Task
            </button>
          )}
        </div>
      ))}
      {pagination && (
        <div>
          Page {pagination.page} of {pagination.totalPages}
          ({pagination.total} total tasks)
        </div>
      )}
    </div>
  );
}
```

---

This documentation provides complete coverage of all task and user endpoints that your frontend application will need. Each endpoint includes detailed request/response examples, access control rules, and practical frontend integration examples.
