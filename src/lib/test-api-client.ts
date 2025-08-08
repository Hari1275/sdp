/**
 * Test script to validate API client utilities
 * This file can be removed after testing
 */

import { extractPaginatedData, extractSingleData } from './api-client';

// Test data structures that match our API responses
const validPaginatedResponse = {
  success: true,
  data: {
    data: [
      { id: '1', name: 'User 1', role: 'ADMIN' },
      { id: '2', name: 'User 2', role: 'MR' }
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    }
  }
};

const simpleArrayResponse = {
  success: true,
  data: [
    { id: '1', name: 'Region 1' },
    { id: '2', name: 'Region 2' }
  ]
};

const invalidResponse1 = {
  success: false,
  error: 'Some error'
};

const invalidResponse2 = {
  success: true,
  data: null
};

const invalidResponse3 = {
  success: true,
  data: 'not an array or object'
};

// Test extractPaginatedData function
console.log('Testing extractPaginatedData:');
console.log('Valid paginated:', extractPaginatedData(validPaginatedResponse)); // Should return the users array
console.log('Simple array:', extractPaginatedData(simpleArrayResponse)); // Should return the array
console.log('Invalid 1:', extractPaginatedData(invalidResponse1)); // Should return []
console.log('Invalid 2:', extractPaginatedData(invalidResponse2)); // Should return []
console.log('Invalid 3:', extractPaginatedData(invalidResponse3)); // Should return []
console.log('Null:', extractPaginatedData(null)); // Should return []
console.log('Undefined:', extractPaginatedData(undefined)); // Should return []

// Test extractSingleData function
console.log('\nTesting extractSingleData:');
console.log('Valid single:', extractSingleData({ success: true, data: { id: '1', name: 'Test' } })); // Should return the object
console.log('Invalid:', extractSingleData(invalidResponse1)); // Should return null
