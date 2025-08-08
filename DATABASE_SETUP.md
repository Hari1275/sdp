# Database Setup Guide

## 🎯 Quick Start - MongoDB Atlas (Recommended)

### Step 1: Create MongoDB Atlas Account
1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. Click "Start Free" or "Try Free"
3. Create account with your email

### Step 2: Create a Cluster
1. After logging in, click "Create Cluster"
2. Choose "FREE" tier (M0 Sandbox)
3. Select your preferred region (closer to your location)
4. Click "Create Cluster" (this takes 1-3 minutes)

### Step 3: Create Database User
1. Click "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Enter username and password (save these!)
5. Select "Built-in Role" → "Read and write to any database"
6. Click "Add User"

### Step 4: Configure Network Access
1. Click "Network Access" in the left sidebar
2. Click "Add IP Address"
3. Choose "Allow Access from Anywhere" (for development)
4. Click "Confirm"

### Step 5: Get Connection String
1. Go back to "Clusters" (Database → Clusters)
2. Click "Connect" button on your cluster
3. Choose "Connect your application"
4. Select "Node.js" and version "4.1 or later"
5. Copy the connection string

### Step 6: Update Environment Variables
1. Open `.env.local` file in the project root
2. Replace the DATABASE_URL with your connection string:
   ```
   DATABASE_URL="mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/sdp-ayurveda-dev?retryWrites=true&w=majority"
   ```
3. Replace `YOUR_USERNAME`, `YOUR_PASSWORD`, and `YOUR_CLUSTER` with your actual values

## 🔧 Alternative - Local MongoDB Installation

### Windows
1. Download [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. Install with default settings
3. MongoDB will run as a Windows service automatically
4. Use connection string: `mongodb://localhost:27017/sdp-ayurveda-dev`

### macOS (with Homebrew)
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb/brew/mongodb-community
```

### Linux (Ubuntu/Debian)
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

## 🧪 Test Your Database Connection

After setting up your database, test the connection:

```bash
# Validate Prisma schema
npm run db:generate

# Push schema to database
npm run db:push

# Test API health (includes database connection)
# Visit: http://localhost:3000/api/health
npm run dev
```

## 📊 Database Tools

### Prisma Studio (Visual Database Editor)
```bash
npm run db:studio
```
This opens a web interface at `http://localhost:5555` to view and edit your database.

### MongoDB Compass (Official GUI)
1. Download [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Use your connection string to connect
3. Explore your database visually

## 🚀 Initialize with Sample Data

Once your database is connected, populate it with sample data:

```bash
# Seed database with sample data
curl -X POST http://localhost:3000/api/seed
```

Or visit: `http://localhost:3000/api/seed` and click the POST button.

## 🔍 Verify Everything Works

1. **Health Check**: `http://localhost:3000/api/health`
2. **Schema Test**: `http://localhost:3000/api/db-test`  
3. **Sample Data**: `http://localhost:3000/api/seed` (POST request)
4. **Prisma Studio**: `npm run db:studio`

## 📝 Common Connection Strings

### MongoDB Atlas
```
mongodb+srv://username:password@cluster.mongodb.net/database-name?retryWrites=true&w=majority
```

### Local MongoDB (Default)
```
mongodb://localhost:27017/sdp-ayurveda-dev
```

### Local MongoDB (with auth)
```
mongodb://username:password@localhost:27017/sdp-ayurveda-dev
```

## ❗ Troubleshooting

### "No available servers" error
- **MongoDB Atlas**: Check network access, ensure your IP is whitelisted
- **Local MongoDB**: Make sure MongoDB service is running (`mongod` command)

### "Authentication failed" error
- **MongoDB Atlas**: Verify username/password in connection string
- **Local MongoDB**: Check if authentication is enabled

### "Invalid connection string" error
- Ensure the connection string format is correct
- Check for special characters in password (URL encode them)
- Verify the database name in the connection string

### Connection timeout
- **MongoDB Atlas**: Check internet connection
- **Local MongoDB**: Verify MongoDB is running on port 27017

## 🔐 Security Notes

- Never commit real credentials to version control
- Use environment variables for all sensitive data
- For production, always use strong passwords and IP restrictions
- Enable MongoDB authentication for local installations

---

**Need Help?** 
- MongoDB Atlas: [Official Documentation](https://docs.atlas.mongodb.com/getting-started/)
- Local MongoDB: [Installation Guide](https://docs.mongodb.com/manual/installation/)
- Prisma: [MongoDB Connector Guide](https://www.prisma.io/docs/concepts/database-connectors/mongodb)
