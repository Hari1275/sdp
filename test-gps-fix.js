#!/usr/bin/env node

/**
 * Test script to verify the GPS coordinate endpoint fix
 */

const https = require('https');

// JWT token from the debug logs (this is a test token, not a real production token)
const TEST_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OTQ3MzJhMGZkNzQ4ZjdiOTNmYTIyOSIsInVzZXJuYW1lIjoibXJfZGVsaGlfMSIsImVtYWlsIjoibXIxLmRlbGhpQHNkcGF5dXJ2ZWRhLmNvbSIsIm5hbWUiOiJWaWthc2ggU2luZ2giLCJyb2xlIjoiTVIiLCJzdGF0dXMiOiJBQ1RJVkUiLCJyZWdpb25JZCI6IjY4OTQ3MzI5MGZkNzQ4ZjdiOTNmYTIxZiIsImxlYWRNcklkIjoiNjg5NDczMmEwZmQ3NDhmN2I5M2ZhMjI3IiwicGhvbmUiOiI5ODc2NTQzMjE1IiwiaWF0IjoxNzU4MDk5NzI2LCJleHAiOjE3NTgxODYxMjZ9.zndUKIXp_eljQTtvG8D5ZiRhwzC0T1-w0aHIYg_y4gI';

// Test data from debug logs (batch endpoint)
const testData = {
    sessionId: '68ca7878befa343f72c5c073',
    coordinates: [
        {
            latitude: 12.7659133,
            longitude: 75.1978057,
            timestamp: '2025-09-17T09:08:52.691660Z',
            accuracy: 14.121000289916992,
            speed: 0.0,
            altitude: 13.500000953674316
        },
        {
            latitude: 12.7659207,
            longitude: 75.1978165,
            timestamp: '2025-09-17T09:16:25.076003Z',
            accuracy: 12.51200008392334,
            speed: 0.0,
            altitude: 13.500000953674316
        }
    ]
};

// Test localhost first (development server)
function testLocalhost() {
    return new Promise((resolve, reject) => {
        console.log('\n🧪 Testing localhost:3000...');
        
        const postData = JSON.stringify(testData);
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/tracking/coordinates/batch',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_JWT}`,
                'X-Platform': 'android',
                'X-App-Version': '1.0.0',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = require('http').request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`📊 Status Code: ${res.statusCode}`);
                console.log(`📄 Response: ${data}`);
                
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('✅ Localhost test passed!');
                    resolve(true);
                } else {
                    console.log('❌ Localhost test failed!');
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.log('❌ Localhost connection error:', e.message);
            resolve(false);
        });

        req.write(postData);
        req.end();
    });
}

// Test production server
function testProduction() {
    return new Promise((resolve, reject) => {
        console.log('\n🌐 Testing production server...');
        
        const postData = JSON.stringify(testData);
        
        const options = {
            hostname: 'app.sdpayurveda.com',
            port: 443,
            path: '/api/tracking/coordinates/batch',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_JWT}`,
                'X-Platform': 'android',
                'X-App-Version': '1.0.0',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`📊 Status Code: ${res.statusCode}`);
                console.log(`📄 Response: ${data}`);
                
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('✅ Production test passed!');
                    resolve(true);
                } else {
                    console.log('❌ Production test failed!');
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.log('❌ Production connection error:', e.message);
            resolve(false);
        });

        req.write(postData);
        req.end();
    });
}

async function runTests() {
    console.log('🚀 Starting GPS Coordinate Endpoint Tests');
    console.log('==========================================');
    
    console.log('\n📋 Test Data:');
    console.log(JSON.stringify(testData, null, 2));
    
    const localhostResult = await testLocalhost();
    
    console.log('\n⏰ Waiting 2 seconds before production test...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const productionResult = await testProduction();
    
    console.log('\n📊 Final Results:');
    console.log('==================');
    console.log(`Localhost: ${localhostResult ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Production: ${productionResult ? '✅ PASS' : '❌ FAIL'}`);
    
    if (localhostResult || productionResult) {
        console.log('\n🎉 At least one environment is working!');
    } else {
        console.log('\n💥 Both environments failed!');
    }
}

// Run the tests
runTests().catch(console.error);