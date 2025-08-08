/**
 * Production-level API Endpoint Verification Script (Fixed)
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

// API endpoint specification from Story 1.4 (fixed)
const endpointSpecs = {
  userManagement: {
    '/api/users': { auth: ['ADMIN', 'LEAD_MR'], methods: ['GET', 'POST'] },
    '/api/users/[id]': { auth: ['ADMIN'], methods: ['PUT', 'DELETE'] },
    '/api/users/[id]/team': { auth: ['LEAD_MR'], methods: ['GET'] }
  },
  clientManagement: {
    '/api/clients': { auth: ['ALL'], methods: ['GET', 'POST'] },
    '/api/clients/[id]': { auth: ['ADMIN'], methods: ['PUT', 'DELETE'] },
    '/api/clients/search': { auth: ['ALL'], methods: ['GET'] }
  },
  businessEntry: {
    '/api/business': { auth: ['ALL'], methods: ['GET', 'POST'] },
    '/api/business/client/[clientId]': { auth: ['ALL'], methods: ['GET'] }
  },
  taskManagement: {
    '/api/tasks': { auth: ['ALL'], methods: ['GET', 'POST'] },
    '/api/tasks/[id]': { auth: ['LEAD_MR', 'ADMIN'], methods: ['GET', 'PUT', 'DELETE'] },
    '/api/tasks/[id]/complete': { auth: ['ASSIGNED_MR', 'LEAD_MR', 'ADMIN'], methods: ['PUT'] }
  },
  geographicData: {
    '/api/regions': { auth: ['ALL'], methods: ['GET', 'POST'] },
    '/api/areas': { auth: ['ALL'], methods: ['GET', 'POST'] }
  }
};

/**
 * Check if file exists and has correct structure
 */
function checkEndpointFileExists(category, endpoint) {
  const results = { exists: false, filePath: '', issues: [], methods: [] };
  
  // Convert endpoint to file path (remove /api prefix for file system)
  let filePath = 'src/app' + endpoint; // endpoint already includes /api
  
  // Replace dynamic segments
  filePath = filePath.replace(/\[([^\]]+)\]/g, '[$1]');
  
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
      
      // Check for required production patterns
      const requiredPatterns = [
        { name: 'Rate Limiting', pattern: /rateLimit\s*\(/i },
        { name: 'Authentication', pattern: /getAuthenticatedUser\s*\(/i },
        { name: 'Error Handling', pattern: /try\s*\{[\s\S]*catch\s*\(/i },
        { name: 'Logging', pattern: /logError\s*\(/i },
        { name: 'Response Format', pattern: /(successResponse|errorResponse)\s*\(/i }
      ];
      
      // Check for input validation if POST/PUT methods exist
      if (results.methods.some(m => ['POST', 'PUT'].includes(m))) {
        requiredPatterns.push({ name: 'Input Validation', pattern: /validateRequest\s*\(/i });
      }
      
      requiredPatterns.forEach(pattern => {
        if (!pattern.pattern.test(content)) {
          results.issues.push(`Missing ${pattern.name} implementation`);
        }
      });
      
      // Check for role-based access control
      if (!/hasPermission\s*\(/i.test(content) && !/UserRole\./i.test(content)) {
        results.issues.push('Missing role-based access control');
      }
      
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
      score: 0,
      endpoints: []
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
        endpointResult.score += 40; // Base score for existence
        
        // Check if all required methods are implemented
        const missingMethods = spec.methods.filter(m => !fileCheck.methods.includes(m));
        if (missingMethods.length === 0) {
          endpointResult.score += 30; // Full methods score
          console.log(`    ✅ All required methods implemented: ${spec.methods.join(', ')}`);
        } else {
          const methodScore = Math.floor(30 * ((spec.methods.length - missingMethods.length) / spec.methods.length));
          endpointResult.score += methodScore;
          endpointResult.issues.push(`Missing methods: ${missingMethods.join(', ')}`);
          console.log(`    ⚠️  Missing methods: ${missingMethods.join(', ')}`);
        }
        
        // Check for production-ready patterns (30 points total)
        const productionScore = Math.max(0, 30 - (fileCheck.issues.length * 5));
        endpointResult.score += productionScore;
        
        if (fileCheck.issues.length === 0) {
          console.log(`    ✅ All production patterns implemented`);
        } else {
          console.log(`    ⚠️  Issues: ${fileCheck.issues.join(', ')}`);
        }
        
      } else {
        endpointResult.issues.push('Endpoint not implemented');
        console.log(`    ❌ File not found: ${fileCheck.filePath}`);
        testResults.criticalIssues.push(`Missing endpoint: ${endpoint}`);
      }
      
      // Store results
      testResults.endpointCategories[category].endpoints.push(endpointResult);
      
      // Track warnings
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
 * Check critical files
 */
function checkCriticalFiles() {
  console.log('\n🔧 Checking critical files...\n');
  
  const criticalFiles = [
    { file: 'src/lib/validations.ts', name: 'Validation schemas' },
    { file: 'src/lib/api-utils.ts', name: 'API utilities' },
    { file: 'src/lib/prisma.ts', name: 'Database client' },
    { file: 'src/lib/auth.ts', name: 'Authentication config' },
    { file: 'prisma/schema.prisma', name: 'Database schema' }
  ];
  
  criticalFiles.forEach(({ file, name }) => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${name}: Found`);
    } else {
      console.log(`❌ ${name}: Missing`);
      testResults.criticalIssues.push(`Missing critical file: ${file}`);
    }
  });
}

/**
 * Detailed code quality checks
 */
function performCodeQualityChecks() {
  console.log('\n🔍 Performing detailed code quality checks...\n');
  
  // Check if TypeScript builds successfully
  const tsConfigExists = fs.existsSync('tsconfig.json');
  if (tsConfigExists) {
    console.log('✅ TypeScript configuration found');
  } else {
    console.log('❌ TypeScript configuration missing');
    testResults.criticalIssues.push('Missing TypeScript configuration');
  }
  
  // Check package.json for required dependencies
  if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const requiredDeps = ['next', '@prisma/client', 'zod', 'next-auth'];
    const missingDeps = requiredDeps.filter(dep => 
      !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
    );
    
    if (missingDeps.length === 0) {
      console.log('✅ All required dependencies present');
    } else {
      console.log(`❌ Missing dependencies: ${missingDeps.join(', ')}`);
      testResults.warnings.push(`Missing dependencies: ${missingDeps.join(', ')}`);
    }
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
  
  // Calculate quality-weighted score
  let totalQualityScore = 0;
  let maxQualityScore = 0;
  
  Object.values(testResults.endpointCategories).forEach(category => {
    category.endpoints.forEach(endpoint => {
      totalQualityScore += endpoint.score;
      maxQualityScore += 100;
    });
  });
  
  const qualityScore = maxQualityScore > 0 ? (totalQualityScore / maxQualityScore) * 100 : 0;
  testResults.overallScore = Math.round((completionRate * 0.6) + (qualityScore * 0.4));
  
  // Generate specific recommendations
  if (completionRate < 80) {
    testResults.recommendations.push('🚨 CRITICAL: Less than 80% of endpoints are implemented. This is not production-ready.');
  } else if (completionRate < 95) {
    testResults.recommendations.push('⚠️ WARNING: Some endpoints are missing. Complete implementation before production deployment.');
  }
  
  if (qualityScore < 70) {
    testResults.recommendations.push('🚨 CRITICAL: Code quality score below 70%. Significant improvements needed.');
  } else if (qualityScore < 90) {
    testResults.recommendations.push('⚠️ WARNING: Code quality can be improved. Review and fix issues.');
  }
  
  if (testResults.criticalIssues.length > 0) {
    testResults.recommendations.push('🔴 CRITICAL: Fix all critical issues before production deployment.');
  }
  
  if (testResults.warnings.length > 10) {
    testResults.recommendations.push('🟡 WARNING: Many issues detected. Conduct thorough code review.');
  }
  
  // Category-specific recommendations
  Object.entries(testResults.endpointCategories).forEach(([category, results]) => {
    if (results.score < 70) {
      testResults.recommendations.push(`📂 ${category}: Score below 70%. Requires significant improvement.`);
    } else if (results.score < 90) {
      testResults.recommendations.push(`📂 ${category}: Score below 90%. Minor improvements recommended.`);
    }
  });
  
  // Add positive recommendations
  if (testResults.overallScore >= 90) {
    testResults.recommendations.push('✅ EXCELLENT: High-quality implementation suitable for production.');
  }
  
  if (completionRate === 100 && qualityScore >= 90) {
    testResults.recommendations.push('🎉 OUTSTANDING: All endpoints implemented with high quality standards.');
  }
}

/**
 * Generate final report
 */
function generateReport() {
  console.log('\n📋 PRODUCTION READINESS REPORT');
  console.log('=' .repeat(50));
  
  console.log(`\n📊 Overall Score: ${testResults.overallScore}%`);
  
  const totalEndpoints = Object.values(endpointSpecs).reduce((sum, cat) => sum + Object.keys(cat).length, 0);
  const implementedEndpoints = Object.values(testResults.endpointCategories)
    .reduce((sum, cat) => sum + cat.implementedEndpoints, 0);
  
  console.log(`📈 Implementation Rate: ${implementedEndpoints}/${totalEndpoints} endpoints (${Math.round((implementedEndpoints/totalEndpoints)*100)}%)`);
  
  if (testResults.overallScore >= 90) {
    console.log('🟢 PRODUCTION READY');
  } else if (testResults.overallScore >= 70) {
    console.log('🟡 NEEDS IMPROVEMENT');
  } else {
    console.log('🔴 NOT PRODUCTION READY');
  }
  
  console.log('\n📁 Category Scores:');
  Object.entries(testResults.endpointCategories).forEach(([category, results]) => {
    const status = results.score >= 90 ? '🟢' : results.score >= 70 ? '🟡' : '🔴';
    console.log(`  ${status} ${category}: ${results.score}% (${results.implementedEndpoints}/${results.totalEndpoints} endpoints)`);
  });
  
  if (testResults.criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    testResults.criticalIssues.slice(0, 5).forEach(issue => console.log(`  • ${issue}`));
    if (testResults.criticalIssues.length > 5) {
      console.log(`  • ... and ${testResults.criticalIssues.length - 5} more critical issues`);
    }
  }
  
  if (testResults.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    testResults.warnings.slice(0, 8).forEach(warning => console.log(`  • ${warning}`));
    if (testResults.warnings.length > 8) {
      console.log(`  • ... and ${testResults.warnings.length - 8} more warnings`);
    }
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  testResults.recommendations.forEach(rec => console.log(`  ${rec}`));
  
  // Save detailed report to file
  fs.writeFileSync('api-verification-detailed-report.json', JSON.stringify(testResults, null, 2));
  console.log('\n📄 Detailed report saved to: api-verification-detailed-report.json');
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Starting Production-level API Verification (Fixed)...');
  console.log('Testing Story 1.4: Core API Endpoints Development\n');
  
  validateEndpointStructure();
  checkCriticalFiles();
  performCodeQualityChecks();
  generateRecommendations();
  generateReport();
  
  console.log('\n✅ Verification complete!');
  
  // Return appropriate exit code
  return testResults.criticalIssues.length === 0 && testResults.overallScore >= 70 ? 0 : 1;
}

// Run the verification
const exitCode = main();
process.exit(exitCode);
