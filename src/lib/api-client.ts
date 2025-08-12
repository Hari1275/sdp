/**
 * Client-side API utility functions to handle API responses consistently
 * and prevent TypeError issues with data structure mismatches.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedApiResponse<T = unknown> {
  success: boolean;
  data: {
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

/**
 * Safe API call wrapper that handles errors and validates response structure
 */
export async function safeApiCall<T>(
  url: string,
  options?: RequestInit
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const result = await response.json();
    
    if (!result.success) {
      return {
        success: false,
        error: result.message || result.error || 'API returned unsuccessful response'
      };
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Extract array data from paginated API response safely
 */
export function extractPaginatedData<T>(response: unknown): T[] {
  // Handle the nested structure: { success: true, data: { data: [...], pagination: {...} } }
  if (
    response &&
    typeof response === 'object' &&
    'success' in response &&
    response.success &&
    'data' in response &&
    response.data &&
    typeof response.data === 'object'
  ) {
    const data = response.data as Record<string, unknown>;
    
    // Check for nested data structure (paginated response)
    if ('data' in data && Array.isArray(data.data)) {
      return data.data;
    }
    
    // Check for direct array (simple response)
    if (Array.isArray(data)) {
      return data;
    }
  }
  
  // console.error('Unexpected API response structure:', response);
  return [];
}

/**
 * Extract single item data from API response safely
 */
export function extractSingleData<T>(response: unknown): T | null {
  if (
    response &&
    typeof response === 'object' &&
    'success' in response &&
    response.success &&
    'data' in response
  ) {
    return (response as { success: boolean; data: T }).data;
  }
  
  // console.error('Unexpected API response structure:', response);
  return null;
}

/**
 * Make a GET request and return the data safely
 */
export async function apiGet<T>(url: string): Promise<T[]> {
  const result = await safeApiCall<unknown>(url);
  
  if (!result.success) {
    // console.error('API GET failed:', result.error);
    return [];
  }
  
  // result.data is the successful API response data
  // Check if it's paginated (has data array and pagination) or direct array
  const responseData = result.data;
  
  if (responseData && typeof responseData === 'object') {
    // Handle paginated response: { data: [...], pagination: {...} }
    if ('data' in responseData && Array.isArray(responseData.data)) {
      return responseData.data as T[];
    }
    
    // Handle direct array response
    if (Array.isArray(responseData)) {
      return responseData as T[];
    }
  }
  
  // Handle direct array at top level
  if (Array.isArray(responseData)) {
    return responseData as T[];
  }
  
  // console.error('Unexpected API response structure:', responseData);
  return [];
}

/**
 * Make a POST request safely
 */
export async function apiPost<T>(
  url: string,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  return safeApiCall<T>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Make a PUT request safely
 */
export async function apiPut<T>(
  url: string,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  return safeApiCall<T>(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Make a DELETE request safely
 */
export async function apiDelete<T>(
  url: string
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  return safeApiCall<T>(url, {
    method: 'DELETE',
  });
}
