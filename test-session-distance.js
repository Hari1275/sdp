// Test script to verify session distance in browser console
// Usage: Copy and paste this into your browser console and replace 'YOUR_SESSION_ID' with the actual session ID

const sessionId = '68caa9fc7d5f140a5c39a107'; // Replace with your actual session ID

console.log(`🔍 Testing session distance for: ${sessionId}`);

// Test 1: Check debug endpoint
fetch(`/api/debug/session-distance?sessionId=${sessionId}`)
  .then(response => response.json())
  .then(data => {
    console.log('🐛 DEBUG ENDPOINT RESULT:');
    console.log(`   Session ID: ${data.sessionId}`);
    console.log(`   Total KM: ${data.totalKm}km`);
    console.log(`   Calculation Method: ${data.calculationMethod}`);
    console.log(`   Route Accuracy: ${data.routeAccuracy}`);
    console.log(`   User: ${data.user?.name}`);
    console.log(`   Timestamp: ${data.timestamp}`);
  })
  .catch(error => console.error('❌ Debug endpoint failed:', error));

// Test 2: Check individual session endpoint
fetch(`/api/tracking/sessions/${sessionId}`)
  .then(response => response.json())
  .then(data => {
    console.log('📊 SESSION ENDPOINT RESULT:');
    console.log(`   Session ID: ${data.id}`);
    console.log(`   Total KM: ${data.totalKm}km`);
    console.log(`   Duration: ${data.duration} hours`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Check In: ${data.checkIn}`);
    console.log(`   Check Out: ${data.checkOut}`);
  })
  .catch(error => console.error('❌ Session endpoint failed:', error));

// Test 3: Check sessions list endpoint
fetch('/api/tracking/sessions?limit=5')
  .then(response => response.json())
  .then(data => {
    console.log('📋 SESSIONS LIST RESULT:');
    const targetSession = data.sessions?.find(s => s.id === sessionId);
    if (targetSession) {
      console.log(`   Found session: ${targetSession.id}`);
      console.log(`   Total KM: ${targetSession.totalKm}km`);
      console.log(`   Duration: ${targetSession.duration} hours`);
    } else {
      console.log(`   Session ${sessionId} not found in list`);
    }
  })
  .catch(error => console.error('❌ Sessions list failed:', error));

console.log('✨ Tests started. Check results above.');