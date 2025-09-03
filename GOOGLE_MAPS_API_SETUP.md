# Google Maps API Setup and Testing Guide

## 🗺️ Current Implementation Status

Your application has **Google Maps API integration implemented** in the following areas:

### ✅ **Features Using Google Maps API:**

1. **Distance Calculations** (`src/lib/gps-utils.ts`)
   - `calculateDistanceWithGoogle()` - Single point-to-point distance
   - `calculateTotalDistanceWithGoogle()` - Multi-waypoint route distance
   - **Fallback Strategy**: Google Routes API → Distance Matrix API → Haversine formula

2. **Live Map Visualization** (`src/components/tracking/live-map.tsx`)
   - Interactive Google Maps with user locations
   - Trail visualization with polylines
   - Real-time location tracking

3. **API Endpoints Using Google Maps:**
   - `/api/tracking/coordinates` - Route distance calculation
   - `/api/tracking/checkout` - Session distance calculation

### 🔧 **Setup Required:**

#### **Step 1: Get Google Maps API Key**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable these APIs:
   - **Maps JavaScript API** (for map display)
   - **Distance Matrix API** (for distance calculations)
   - **Routes API** (for advanced routing)
4. Create credentials → API Key
5. Restrict the API key to your domain

#### **Step 2: Configure Environment Variables**
Create a `.env.local` file in your project root:

```env
# Google Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

#### **Step 3: Test Implementation**

**Test 1: Check Map Display**
1. Go to: `http://localhost:3000/admin/users`
2. Click any user to open User Details Modal
3. Go to "Map" tab
4. You should see:
   - ✅ Interactive Google Map (if API key is set)
   - ❌ "Google Maps API key not configured" message (if not set)

**Test 2: Check Distance Calculations**
1. Go to: `http://localhost:3000/admin/tracking`
2. Look at "Total Km" values in Active Sessions
3. Check browser console for:
   - ✅ `Distance calculated using google_api: X.Xkm`
   - ⚠️ `Distance calculated using haversine: X.Xkm` (fallback)

### 🐛 **Troubleshooting:**

#### **Issue: "Old route paths still showing"**

**Cause:** If you're seeing old/cached route data, it could be:

1. **API Key Not Set**: App falls back to Haversine calculation (straight-line distance)
2. **API Quotas Exceeded**: Google Maps API has usage limits
3. **Cached Data**: Browser/database caching old calculations

**Solutions:**

```javascript
// Check if API key is configured (in browser console)
console.log('API Key configured:', !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

// Check calculation method in network tab
// Look for these API calls:
// - https://maps.googleapis.com/maps/api/distancematrix/json
// - https://routes.googleapis.com/directions/v2:computeRoutes
```

#### **Issue: Maps not loading**

**Symptoms:** 
- Gray box instead of map
- "Google Maps API key not configured" message

**Solutions:**
1. Verify API key is set in `.env.local`
2. Check API key has correct permissions
3. Verify Maps JavaScript API is enabled

### 📊 **Current Fallback Logic:**

```
Google Routes API (Best accuracy)
       ↓ (if fails)
Distance Matrix API (Good accuracy)
       ↓ (if fails)  
Haversine Formula (Basic accuracy - straight line)
```

### 🧪 **Quick Tests:**

```bash
# Test 1: Check if development server detects API key
grep -r "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" .env.local

# Test 2: Check API calls in browser
# Open Network tab → Filter by "googleapis.com"
# Should see API calls when users move/create routes

# Test 3: Console logs
# Look for: "Distance calculated using [method]: [distance]km"
```

### 🔍 **Verification Checklist:**

- [ ] `.env.local` file exists with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key`
- [ ] Google Cloud Console APIs enabled (Maps JS, Distance Matrix, Routes)
- [ ] API key has proper domain restrictions
- [ ] Browser console shows successful API calls to googleapis.com
- [ ] Map displays in User Details → Map tab
- [ ] Distance calculations use "google_api" method (not "haversine")

---

**🚀 Result:** Once properly configured, your app will use Google's routing algorithms for accurate distance calculations instead of straight-line distances, and display interactive maps with real GPS trails.
