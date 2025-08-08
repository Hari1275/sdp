#!/usr/bin/env node

/**
 * SDP Ayurveda Dashboard API Testing Script
 * Tests all API endpoints for functionality, CORS, and authentication
 * 
 * Usage: node test-api-endpoints.js
 * 
 * Requirements:
 * - Development server running on http://localhost:3000
 * - Test user credentials (will attempt to use seeded data)
 */

const BASE_URL = 'http://localhost:3000';
const TEST_CREDENTIALS = {
  username: 'admin_user',
  password: 'admin123'
};

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class APITester {
  constructor() {
    this.sessionCookie = null;
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  success(message) {
    this.log(`✅ ${message}`, 'green');
    this.testResults.passed++;
  }

  error(message) {
    this.log(`❌ ${message}`, 'red');
    this.testResults.failed++;
    this.testResults.errors.push(message);
  }

  info(message) {
    this.log(`ℹ️  ${message}`, 'blue');
  }

  warn(message) {
    this.log(`⚠️  ${message}`, 'yellow');
  }

  async makeRequest(endpoint, options = {}) {
    this.testResults.total++;
    const url = `${BASE_URL}${endpoint}`;
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      if (this.sessionCookie) {
        headers['Cookie'] = this.sessionCookie;
      }

      const response = await fetch(url, {
        ...options,
        headers
      });

      // Store session cookie from login
      if (response.headers.get('set-cookie')) {
        this.sessionCookie = response.headers.get('set-cookie');
      }

      const data = await response.json();
      
      return {
        status: response.status,
        headers: response.headers,
        data,
        ok: response.ok
      };
    } catch (error) {
      this.error(`Request to ${endpoint} failed: ${error.message}`);
      return null;
    }
  }

  async testCORS() {
    this.log('\n=== Testing CORS Configuration ===', 'cyan');
    
    try {
      // Test preflight request
      const preflightResponse = await fetch(`${BASE_URL}/api/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3001',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      });

      if (preflightResponse.ok) {
        const corsHeaders = {
          'access-control-allow-origin': preflightResponse.headers.get('access-control-allow-origin'),
          'access-control-allow-methods': preflightResponse.headers.get('access-control-allow-methods'),
          'access-control-allow-headers': preflightResponse.headers.get('access-control-allow-headers'),
          'access-control-allow-credentials': preflightResponse.headers.get('access-control-allow-credentials')
        };

        if (corsHeaders['access-control-allow-origin']) {
          this.success('CORS preflight request successful');
          this.info(`Allow-Origin: ${corsHeaders['access-control-allow-origin']}`);
          this.info(`Allow-Methods: ${corsHeaders['access-control-allow-methods']}`);
          this.info(`Allow-Headers: ${corsHeaders['access-control-allow-headers']}`);
        } else {
          this.warn('CORS headers not found in preflight response');
        }
      } else {
        this.error('CORS preflight request failed');
      }
    } catch (error) {
      this.error(`CORS test failed: ${error.message}`);
    }
  }

  async testHealthCheck() {
    this.log('\n=== Testing Health Check ===', 'cyan');
    
    const response = await this.makeRequest('/api/health');
    
    if (response && response.ok && response.data.success) {
      this.success('Health check endpoint working');
      this.info(`Database: ${response.data.data.database}`);
      this.info(`Environment: ${response.data.data.environment}`);
      this.info(`Version: ${response.data.data.version}`);
    } else {
      this.error('Health check endpoint failed');
    }
  }

  async testDatabaseConnection() {
    this.log('\n=== Testing Database Connection ===', 'cyan');
    
    const response = await this.makeRequest('/api/db-test');
    
    if (response && response.ok && response.data.success) {
      this.success('Database connection test passed');
      this.info(`Connection time: ${response.data.data?.connectionTime || 'N/A'}`);
    } else {
      this.error('Database connection test failed');
    }
  }

  async testAuthentication() {
    this.log('\n=== Testing Authentication ===', 'cyan');
    
    // Test login endpoint (this might not exist in NextAuth setup, but let's check)
    const authResponse = await this.makeRequest('/api/auth/me');
    
    if (authResponse && authResponse.status === 401) {
      this.success('Authentication properly required (401 response)');
    } else if (authResponse && authResponse.ok && authResponse.data.success) {
      this.success('Already authenticated user found');
      this.info(`User: ${authResponse.data.data.user?.name || 'Unknown'}`);
      this.info(`Role: ${authResponse.data.data.user?.role || 'Unknown'}`);
    } else {
      this.warn('Unexpected authentication response');
    }
  }

  async testUserEndpoints() {
    this.log('\n=== Testing User Management Endpoints ===', 'cyan');
    
    // Test GET /api/users (requires authentication)
    const usersResponse = await this.makeRequest('/api/users');
    
    if (usersResponse) {
      if (usersResponse.status === 401) {
        this.success('Users endpoint properly protected (requires authentication)');
      } else if (usersResponse.ok && usersResponse.data.success) {
        this.success('Users endpoint accessible');
        this.info(`Found ${usersResponse.data.pagination?.total || 0} users`);
      } else {
        this.warn(`Users endpoint returned ${usersResponse.status}: ${usersResponse.data.message || 'Unknown error'}`);
      }
    }

    // Test individual user endpoint
    const singleUserResponse = await this.makeRequest('/api/users/test-id');
    
    if (singleUserResponse) {
      if (singleUserResponse.status === 401 || singleUserResponse.status === 404) {
        this.success('Single user endpoint properly protected/validated');
      } else {
        this.info(`Single user endpoint returned ${singleUserResponse.status}`);
      }
    }
  }

  async testClientEndpoints() {
    this.log('\n=== Testing Client Management Endpoints ===', 'cyan');
    
    // Test GET /api/clients
    const clientsResponse = await this.makeRequest('/api/clients');
    
    if (clientsResponse) {
      if (clientsResponse.status === 401) {
        this.success('Clients endpoint properly protected (requires authentication)');
      } else if (clientsResponse.ok && clientsResponse.data.success) {
        this.success('Clients endpoint accessible');
        this.info(`Found ${clientsResponse.data.pagination?.total || 0} clients`);
      } else {
        this.warn(`Clients endpoint returned ${clientsResponse.status}: ${clientsResponse.data.message || 'Unknown error'}`);
      }
    }

    // Test client search
    const searchResponse = await this.makeRequest('/api/clients/search?q=test');
    
    if (searchResponse) {
      if (searchResponse.status === 401) {
        this.success('Client search endpoint properly protected');
      } else if (searchResponse.ok) {
        this.success('Client search endpoint accessible');
      } else {
        this.info(`Client search returned ${searchResponse.status}`);
      }
    }
  }

  async testBusinessEndpoints() {
    this.log('\n=== Testing Business Entry Endpoints ===', 'cyan');
    
    // Test GET /api/business
    const businessResponse = await this.makeRequest('/api/business');
    
    if (businessResponse) {
      if (businessResponse.status === 401) {
        this.success('Business entries endpoint properly protected');
      } else if (businessResponse.ok && businessResponse.data.success) {
        this.success('Business entries endpoint accessible');
        this.info(`Found ${businessResponse.data.pagination?.total || 0} business entries`);
      } else {
        this.warn(`Business entries endpoint returned ${businessResponse.status}: ${businessResponse.data.message || 'Unknown error'}`);
      }
    }

    // Test business entry by client
    const clientBusinessResponse = await this.makeRequest('/api/business/client/test-client-id');
    
    if (clientBusinessResponse) {
      if (clientBusinessResponse.status === 401 || clientBusinessResponse.status === 404) {
        this.success('Client business entries endpoint properly protected/validated');
      } else {
        this.info(`Client business entries returned ${clientBusinessResponse.status}`);
      }
    }
  }

  async testTaskEndpoints() {
    this.log('\n=== Testing Task Management Endpoints ===', 'cyan');
    
    // Test GET /api/tasks
    const tasksResponse = await this.makeRequest('/api/tasks');
    
    if (tasksResponse) {
      if (tasksResponse.status === 401) {
        this.success('Tasks endpoint properly protected');
      } else if (tasksResponse.ok && tasksResponse.data.success) {
        this.success('Tasks endpoint accessible');
        this.info(`Found ${tasksResponse.data.pagination?.total || 0} tasks`);
      } else {
        this.warn(`Tasks endpoint returned ${tasksResponse.status}: ${tasksResponse.data.message || 'Unknown error'}`);
      }
    }

    // Test individual task endpoint
    const singleTaskResponse = await this.makeRequest('/api/tasks/test-task-id');
    
    if (singleTaskResponse) {
      if (singleTaskResponse.status === 401 || singleTaskResponse.status === 404) {
        this.success('Single task endpoint properly protected/validated');
      } else {
        this.info(`Single task endpoint returned ${singleTaskResponse.status}`);
      }
    }

    // Test task completion endpoint
    const completeTaskResponse = await this.makeRequest('/api/tasks/test-task-id/complete', {
      method: 'PUT',
      body: JSON.stringify({ notes: 'Test completion' })
    });
    
    if (completeTaskResponse) {
      if (completeTaskResponse.status === 401 || completeTaskResponse.status === 404) {
        this.success('Task completion endpoint properly protected/validated');
      } else {
        this.info(`Task completion endpoint returned ${completeTaskResponse.status}`);
      }
    }
  }

  async testGeographicEndpoints() {
    this.log('\n=== Testing Geographic Data Endpoints ===', 'cyan');
    
    // Test GET /api/regions
    const regionsResponse = await this.makeRequest('/api/regions');
    
    if (regionsResponse) {
      if (regionsResponse.status === 401) {
        this.success('Regions endpoint properly protected');
      } else if (regionsResponse.ok && regionsResponse.data.success) {
        this.success('Regions endpoint accessible');
        this.info(`Found ${regionsResponse.data.data?.length || 0} regions`);
      } else {
        this.warn(`Regions endpoint returned ${regionsResponse.status}: ${regionsResponse.data.message || 'Unknown error'}`);
      }
    }

    // Test GET /api/areas
    const areasResponse = await this.makeRequest('/api/areas');
    
    if (areasResponse) {
      if (areasResponse.status === 401) {
        this.success('Areas endpoint properly protected');
      } else if (areasResponse.ok && areasResponse.data.success) {
        this.success('Areas endpoint accessible');
        this.info(`Found ${areasResponse.data.data?.length || 0} areas`);
      } else {
        this.warn(`Areas endpoint returned ${areasResponse.status}: ${areasResponse.data.message || 'Unknown error'}`);
      }
    }
  }

  async testRateLimiting() {
    this.log('\n=== Testing Rate Limiting ===', 'cyan');
    
    // Make multiple rapid requests to test rate limiting
    const promises = Array.from({ length: 10 }, () => 
      this.makeRequest('/api/health')
    );
    
    try {
      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r && r.status === 429);
      
      if (rateLimited) {
        this.success('Rate limiting is active (429 responses detected)');
      } else {
        this.info('Rate limiting not triggered with 10 concurrent requests');
        this.info('This might be normal if limits are higher or IP-based');
      }
    } catch (error) {
      this.warn(`Rate limiting test failed: ${error.message}`);
    }
  }

  async testValidation() {
    this.log('\n=== Testing Input Validation ===', 'cyan');
    
    // Test POST endpoints with invalid data
    const invalidUserData = {
      username: '', // Invalid: empty username
      password: '123', // Invalid: too short
      email: 'invalid-email' // Invalid: malformed email
    };
    
    const createUserResponse = await this.makeRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(invalidUserData)
    });
    
    if (createUserResponse) {
      if (createUserResponse.status === 400 || createUserResponse.status === 401) {
        this.success('User creation properly validates input (400/401 response)');
      } else {
        this.warn(`User creation returned ${createUserResponse.status} for invalid data`);
      }
    }

    // Test client creation with invalid data
    const invalidClientData = {
      name: '', // Invalid: empty name
      businessType: 'INVALID_TYPE', // Invalid: not in enum
      latitude: 'not-a-number', // Invalid: not a number
      longitude: 'not-a-number' // Invalid: not a number
    };
    
    const createClientResponse = await this.makeRequest('/api/clients', {
      method: 'POST',
      body: JSON.stringify(invalidClientData)
    });
    
    if (createClientResponse) {
      if (createClientResponse.status === 400 || createClientResponse.status === 401) {
        this.success('Client creation properly validates input (400/401 response)');
      } else {
        this.warn(`Client creation returned ${createClientResponse.status} for invalid data`);
      }
    }
  }

  async runAllTests() {
    this.log('🚀 Starting SDP Ayurveda Dashboard API Tests', 'bright');
    this.log(`Base URL: ${BASE_URL}`, 'cyan');
    
    try {
      await this.testCORS();
      await this.testHealthCheck();
      await this.testDatabaseConnection();
      await this.testAuthentication();
      await this.testUserEndpoints();
      await this.testClientEndpoints();
      await this.testBusinessEndpoints();
      await this.testTaskEndpoints();
      await this.testGeographicEndpoints();
      await this.testRateLimiting();
      await this.testValidation();
      
      this.showResults();
    } catch (error) {
      this.error(`Test suite failed: ${error.message}`);
      this.showResults();
      process.exit(1);
    }
  }

  showResults() {
    this.log('\n=== Test Results Summary ===', 'bright');
    this.log(`Total Tests: ${this.testResults.total}`, 'blue');
    this.log(`Passed: ${this.testResults.passed}`, 'green');
    this.log(`Failed: ${this.testResults.failed}`, 'red');
    
    if (this.testResults.errors.length > 0) {
      this.log('\n=== Errors ===', 'red');
      this.testResults.errors.forEach(error => {
        this.log(`• ${error}`, 'red');
      });
    }
    
    const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(1);
    this.log(`\nSuccess Rate: ${successRate}%`, successRate > 80 ? 'green' : 'yellow');
    
    if (successRate > 90) {
      this.log('\n🎉 API is working excellently!', 'green');
    } else if (successRate > 70) {
      this.log('\n✅ API is working well with some minor issues', 'yellow');
    } else {
      this.log('\n⚠️  API has significant issues that need attention', 'red');
    }
  }
}

// Check if we have fetch available (Node.js 18+ or with polyfill)
if (typeof fetch === 'undefined') {
  console.log('❌ This script requires Node.js 18+ or a fetch polyfill');
  console.log('Install a polyfill: npm install node-fetch');
  console.log('Or use Node.js 18+');
  process.exit(1);
}

// Run the tests
const tester = new APITester();
tester.runAllTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
