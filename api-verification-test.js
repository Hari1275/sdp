/**
 * Production-level API Endpoint Verification Script
 * Tests all Story 1.4 Core API Endpoints for production readiness
 */

const fs = require('fs');
const path = require('path');

// Test results storage
const testResults = {
  timestamp: new Date().toISOString(),
  endpointCategories: {},
  overallScore: 0,
  criticalIssues: [],
  warnings: [],
  recommendations: []
};

// API endpoint specification from Story 1.4
const endpointSpecs = {
  userManagement: {
    'GET /api/users': { auth: ['ADMIN', 'LEAD_MR'], params: ['role', 'region', 'isActive'], methods: ['GET'] },
    'POST /api/users': { auth: ['ADMIN'], body: ['username', 'password', 'name', 'role', 'region'], methods: ['POST'] },
    'PUT /api/users/[id]': { auth: ['ADMIN'], body: ['name', 'role', 'region', 'leadMRId', 'isActive'], methods: ['PUT'] },
    'DELETE /api/users/[id]': { auth: ['ADMIN'], response: ['success'], methods: ['DELETE'] },
    'GET /api/users/[id]/team': { auth: ['LEAD_MR'], params: [], methods: ['GET'] }
  },
  clientManagement: {
    'GET /api/clients': { auth: ['ALL'], params: ['region', 'area', 'businessType'], methods: ['GET'] },
    'POST /api/clients': { auth: ['MR', 'LEAD_MR', 'ADMIN'], body: ['name', 'phone', 'businessType', 'area', 'region'], methods: ['POST'] },
    'PUT /api/clients/[id]': { auth: ['ADMIN'], body: ['name', 'phone', 'businessType', 'area', 'region'], methods: ['PUT'] },
    'DELETE /api/clients/[id]': { auth: ['ADMIN'], response: ['success'], methods: ['DELETE'] },
    'GET /api/clients/search': { auth: ['ALL'], params: ['query'], methods: ['GET'] }
  },
  businessEntry: {
    'GET /api/business': { auth: ['ALL'], params: ['clientId', 'region', 'dateFrom', 'dateTo'], methods: ['GET'] },
    'POST /api/business': { auth: ['MR', 'LEAD_MR', 'ADMIN'], body: ['amount', 'notes', 'clientId', 'latitude', 'longitude'], methods: ['POST'] },
    'GET /api/business/client/[clientId]': { auth: ['ALL'], params: ['dateFrom', 'dateTo'], methods: ['GET'] }
  },
  taskManagement: {
    'GET /api/tasks': { auth: ['ALL'], params: ['assignedTo', 'region', 'area', 'status'], methods: ['GET'] },
    'POST /api/tasks': { auth: ['LEAD_MR', 'ADMIN'], body: ['title', 'description', 'region', 'area', 'dueDate', 'assignedTo'], methods: ['POST'] },
    'PUT /api/tasks/[id]': { auth: ['LEAD_MR', 'ADMIN'], body: ['title', 'description', 'region', 'area', 'dueDate', 'assignedTo'], methods: ['PUT'] },
    'PUT /api/tasks/[id]/complete': { auth: ['ASSIGNED_MR', 'LEAD_MR', 'ADMIN'], response: ['success'], methods: ['PUT'] },
    'DELETE /api/tasks/[id]': { auth: ['LEAD_MR', 'ADMIN'], response: ['success'], methods: ['DELETE'] }
  },
  geographicData: {
    'GET /api/regions': { auth: ['ALL'], params: [], methods: ['GET'] },
    'POST /api/regions': { auth: ['ADMIN'], body: ['name'], methods: ['POST'] },
    'GET /api/areas': { auth: ['ALL'], params: ['regionId'], methods: ['GET'] },
    'POST /api/areas': { auth: ['ADMIN'], body: ['name', 'regionId'], methods: ['POST'] }
  }
};

/**
 * Check if file exists and has correct structure
 */
function checkEndpointFileExists(category, endpoint) {
  const results = { exists: false, filePath: '', issues: [], methods: [] };
  
  // Convert endpoint to file path
  let filePath = 'src/app/api';
  const parts = endpoint.split('/').filter(p => p && p !== 'api');
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('[') && part.endsWith(']')) {
      filePath += `/${part}`;
    } else {
      filePath += `/${part}`;
    }
  }
  
  // Check for route.ts file
  const routeFilePath = `${filePath}/route.ts`;
  results.filePath = routeFilePath;
  
  if (fs.existsSync(routeFilePath)) {
    results.exists = true;
    
    // Read file content to check methods
    try {
      const content = fs.readFileSync(routeFilePath, 'utf-8');
      
      // Check for HTTP methods
      const methodPattern = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g;
      let match;
      while ((match = methodPattern.exec(content)) !== null) {
        results.methods.push(match[1]);
      }
      
      // Check for required patterns
      const requiredPatterns = [
        { name: 'Rate Limiting', pattern: /rateLimit\s*\(/i },
        { name: 'Authentication', pattern: /getAuthenticatedUser\s*\(/i },
        { name: 'Error Handling', pattern: /try\s*\{[\s\S]*catch\s*\(/i },
        { name: 'Input Validation', pattern: /validateRequest\s*\(/i },
        { name: 'Logging', pattern: /logError\s*\(/i },
        { name: 'Response Format', pattern: /(successResponse|errorResponse)\s*\(/i }
      ];
      
      requiredPatterns.forEach(pattern => {
        if (!pattern.pattern.test(content)) {
          results.issues.push(`Missing ${pattern.name} implementation`);
        }
      });
      
    } catch (error) {
      results.issues.push(`Error reading file: ${error.message}`);
    }
  } else {
    results.issues.push('File does not exist');
  }
  
  return results;
}

/**
 * Validate API endpoint structure
 */
function validateEndpointStructure() {
  console.log('🔍 Validating API endpoint structure...\n');
  
  for (const [category, endpoints] of Object.entries(endpointSpecs)) {
    console.log(`\n📁 Category: ${category.toUpperCase()}`);
    testResults.endpointCategories[category] = {
      totalEndpoints: Object.keys(endpoints).length,
      implementedEndpoints: 0,
      issues: [],
      score: 0
    };
    
    for (const [endpoint, spec] of Object.entries(endpoints)) {
      console.log(`  🔗 Testing: ${endpoint}`);
      
      const fileCheck = checkEndpointFileExists(category, endpoint);
      const endpointResult = {
        endpoint,
        fileExists: fileCheck.exists,
        filePath: fileCheck.filePath,
        implementedMethods: fileCheck.methods,
        requiredMethods: spec.methods,
        issues: [...fileCheck.issues],
        score: 0
      };
      
      if (fileCheck.exists) {
        testResults.endpointCategories[category].implementedEndpoints++;
        endpointResult.score += 30; // Base score for existence
        
        // Check if all required methods are implemented
        const missingMethods = spec.methods.filter(m => !fileCheck.methods.includes(m));
        if (missingMethods.length === 0) {
          endpointResult.score += 30; // Full methods score
          console.log(`    ✅ All required methods implemented: ${spec.methods.join(', ')}`);
        } else {
          endpointResult.score += Math.floor(30 * ((spec.methods.length - missingMethods.length) / spec.methods.length));
          endpointResult.issues.push(`Missing methods: ${missingMethods.join(', ')}`);
          console.log(`    ⚠️  Missing methods: ${missingMethods.join(', ')}`);
        }
        
        // Check for production-ready patterns (40 points total)
        const productionScore = Math.max(0, 40 - (fileCheck.issues.length * 5));
        endpointResult.score += productionScore;
        
        if (fileCheck.issues.length === 0) {
          console.log(`    ✅ All production patterns implemented`);
        } else {
          console.log(`    ⚠️  Issues: ${fileCheck.issues.join(', ')}`);
        }
        
      } else {
        endpointResult.issues.push('Endpoint not implemented');
        console.log(`    ❌ File not found: ${fileCheck.filePath}`);
      }
      
      // Store results
      if (!testResults.endpointCategories[category].endpoints) {
        testResults.endpointCategories[category].endpoints = [];
      }
      testResults.endpointCategories[category].endpoints.push(endpointResult);
      
      // Track critical issues
      if (!fileCheck.exists) {
        testResults.criticalIssues.push(`Missing endpoint: ${endpoint}`);
      }
      
      if (endpointResult.issues.length > 0) {
        testResults.warnings.push(...endpointResult.issues.map(issue => `${endpoint}: ${issue}`));
      }
    }
    
    // Calculate category score
    const categoryScore = testResults.endpointCategories[category].endpoints
      .reduce((sum, ep) => sum + ep.score, 0) / (Object.keys(endpoints).length * 100);
    testResults.endpointCategories[category].score = Math.round(categoryScore * 100);
    
    console.log(`  📊 Category Score: ${testResults.endpointCategories[category].score}%`);
  }
}

/**
 * Check validation schemas
 */
function checkValidationSchemas() {
  console.log('\n🛡️  Checking validation schemas...\n');
  
  const validationFile = 'src/lib/validations.ts';
  if (!fs.existsSync(validationFile)) {
    testResults.criticalIssues.push('Validation schemas file missing');
    return;
  }
  
  const content = fs.readFileSync(validationFile, 'utf-8');
  
  // Check for required schemas
  const requiredSchemas = [
    'createUserSchema',
    'updateUserSchema',
    'createClientSchema',
    'updateClientSchema', 
    'createBusinessEntrySchema',
    'createTaskSchema',
    'updateTaskSchema',
    'createRegionSchema',
    'createAreaSchema'
  ];
  
  const missingSchemas = requiredSchemas.filter(schema => !content.includes(schema));
  
  if (missingSchemas.length === 0) {
    console.log('✅ All required validation schemas present');
  } else {
    console.log(`❌ Missing validation schemas: ${missingSchemas.join(', ')}`);
    testResults.criticalIssues.push(`Missing validation schemas: ${missingSchemas.join(', ')}`);
  }
}

/**
 * Check API utilities
 */
function checkAPIUtilities() {
  console.log('\n🔧 Checking API utilities...\n');
  
  const utilsFile = 'src/lib/api-utils.ts';
  if (!fs.existsSync(utilsFile)) {
    testResults.criticalIssues.push('API utilities file missing');
    return;
  }
  
  const content = fs.readFileSync(utilsFile, 'utf-8');
  
  const requiredUtils = [
    'getAuthenticatedUser',
    'hasPermission',
    'successResponse',
    'errorResponse',
    'validateRequest',
    'rateLimit',
    'logError',
    'parseQueryParams'
  ];
  
  const missingUtils = requiredUtils.filter(util => !content.includes(util));
  
  if (missingUtils.length === 0) {
    console.log('✅ All required API utilities present');
  } else {
    console.log(`❌ Missing API utilities: ${missingUtils.join(', ')}`);
    testResults.criticalIssues.push(`Missing API utilities: ${missingUtils.join(', ')}`);
  }
}

/**
 * Generate recommendations
 */
function generateRecommendations() {
  console.log('\n💡 Generating recommendations...\n');
  
  // Check overall implementation completeness
  const totalEndpoints = Object.values(endpointSpecs).reduce((sum, cat) => sum + Object.keys(cat).length, 0);
  const implementedEndpoints = Object.values(testResults.endpointCategories)
    .reduce((sum, cat) => sum + cat.implementedEndpoints, 0);
  
  const completionRate = (implementedEndpoints / totalEndpoints) * 100;
  testResults.overallScore = Math.round(completionRate);
  
  // Generate recommendations based on results
  if (completionRate < 80) {
    testResults.recommendations.push('🚨 CRITICAL: Less than 80% of endpoints are implemented. This is not production-ready.');
  } else if (completionRate < 95) {
    testResults.recommendations.push('⚠️ WARNING: Some endpoints are missing. Complete implementation before production deployment.');
  } else if (completionRate === 100) {
    testResults.recommendations.push('✅ EXCELLENT: All endpoints are implemented.');
  }
  
  if (testResults.criticalIssues.length > 0) {
    testResults.recommendations.push('🔴 CRITICAL: Fix all critical issues before production deployment.');
  }
  
  if (testResults.warnings.length > 5) {
    testResults.recommendations.push('🟡 WARNING: Multiple issues detected. Review and fix warnings for better production stability.');
  }
  
  // Category-specific recommendations
  for (const [category, results] of Object.entries(testResults.endpointCategories)) {
    if (results.score < 70) {
      testResults.recommendations.push(`📂 ${category}: Score below 70%. Requires significant improvement.`);
    } else if (results.score < 90) {
      testResults.recommendations.push(`📂 ${category}: Score below 90%. Minor improvements needed.`);
    }
  }
}

/**
 * Generate final report
 */
function generateReport() {
  console.log('\n📋 PRODUCTION READINESS REPORT');
  console.log('=' .repeat(50));
  
  console.log(`\n📊 Overall Score: ${testResults.overallScore}%`);
  
  if (testResults.overallScore >= 90) {
    console.log('🟢 PRODUCTION READY');
  } else if (testResults.overallScore >= 70) {
    console.log('🟡 NEEDS IMPROVEMENT');
  } else {
    console.log('🔴 NOT PRODUCTION READY');
  }
  
  console.log('\n📁 Category Scores:');
  for (const [category, results] of Object.entries(testResults.endpointCategories)) {
    const status = results.score >= 90 ? '🟢' : results.score >= 70 ? '🟡' : '🔴';
    console.log(`  ${status} ${category}: ${results.score}% (${results.implementedEndpoints}/${results.totalEndpoints} endpoints)`);
  }
  
  if (testResults.criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    testResults.criticalIssues.forEach(issue => console.log(`  • ${issue}`));
  }
  
  if (testResults.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    testResults.warnings.slice(0, 10).forEach(warning => console.log(`  • ${warning}`));
    if (testResults.warnings.length > 10) {
      console.log(`  • ... and ${testResults.warnings.length - 10} more warnings`);
    }
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  testResults.recommendations.forEach(rec => console.log(`  ${rec}`));
  
  // Save detailed report to file
  fs.writeFileSync('api-verification-report.json', JSON.stringify(testResults, null, 2));
  console.log('\n📄 Detailed report saved to: api-verification-report.json');
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Starting Production-level API Verification...');
  console.log('Testing Story 1.4: Core API Endpoints Development\n');
  
  validateEndpointStructure();
  checkValidationSchemas();
  checkAPIUtilities();
  generateRecommendations();
  generateReport();
  
  console.log('\n✅ Verification complete!');
  
  // Exit with appropriate code
  process.exit(testResults.criticalIssues.length > 0 ? 1 : 0);
}

// Run the verification
main();
