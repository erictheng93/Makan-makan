# 🚀 MakanMakan Deployment Setup Guide

## 🔐 **SECURITY CRITICAL**: Complete These Steps Before Deployment

### 1. **Environment Variables Setup**

#### Generate Secure JWT Secret
```bash
# Generate a secure 64-character JWT secret
openssl rand -hex 32
# Example output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# Set it in Cloudflare using wrangler
wrangler secret put JWT_SECRET --env production
# Paste the generated secret when prompted
```

#### Set Other Required Secrets
```bash
# Set Cloudflare API token (get from CF dashboard)
wrangler secret put CLOUDFLARE_API_TOKEN --env production

# Set Slack webhook for error notifications (optional)
wrangler secret put SLACK_WEBHOOK_URL --env production
```

### 2. **Database Setup**

#### Create D1 Databases
```bash
# Create staging database
wrangler d1 create makanmakan-staging

# Create production database  
wrangler d1 create makanmakan-prod

# Copy the database IDs from output and update wrangler.toml files
```

#### Apply Database Migrations
```bash
# Apply to staging
wrangler d1 migrations apply makanmakan-staging --env staging

# Apply to production
wrangler d1 migrations apply makanmakan-prod --env production
```

### 3. **KV Namespace Setup**

#### Create KV Namespaces for Each Service
```bash
# Image processor KV namespaces
wrangler kv:namespace create "IMAGE_CACHE" --env staging
wrangler kv:namespace create "IMAGE_CACHE" --env production

# Realtime service KV namespaces
wrangler kv:namespace create "REALTIME_CACHE" --env staging
wrangler kv:namespace create "REALTIME_CACHE" --env production

# API service KV namespaces (for rate limiting, caching)
wrangler kv:namespace create "API_CACHE" --env staging
wrangler kv:namespace create "API_CACHE" --env production
```

### 4. **Update Wrangler Configuration IDs**

Replace all placeholder IDs in wrangler.toml files with actual Cloudflare resource IDs:

#### Files to Update:
- `apps/api/wrangler.toml`
- `apps/realtime/wrangler.toml`
- `apps/image-processor/wrangler.toml`

#### Search and Replace:
```bash
# Find all placeholder IDs
grep -r "TO_BE_REPLACED" apps/*/wrangler.toml

# Replace with actual IDs from wrangler output above
```

### 5. **Security Verification Checklist**

#### ✅ Secrets Management
- [ ] JWT_SECRET set via wrangler secrets (not in code/config)
- [ ] All API tokens stored as secrets
- [ ] No hardcoded credentials in any files
- [ ] `.env.local` removed from version control

#### ✅ Database Security
- [ ] All database IDs updated to real Cloudflare resource IDs
- [ ] Migrations applied to all environments
- [ ] Database access restricted to Workers

#### ✅ Application Security
- [ ] All authentication endpoints secured
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled
- [ ] Security headers implemented

### 6. **Deployment Commands**

#### Deploy to Staging
```bash
# Build and deploy all services to staging
npm run deploy:staging
```

#### Deploy to Production
```bash
# Build and deploy all services to production
npm run deploy:prod
```

### 7. **Post-Deployment Verification**

#### Test Critical Security Functions
```bash
# Test JWT secret is working
curl -X POST https://api.makanmakan.app/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"test","password":"test"}'

# Verify rate limiting
for i in {1..10}; do curl https://api.makanmakan.app/api/v1/health; done

# Test CORS headers
curl -I https://api.makanmakan.app/api/v1/health
```

## 🚨 **CRITICAL SECURITY WARNINGS**

### ❌ **DO NOT**:
- Commit JWT secrets to version control
- Use placeholder IDs in production
- Deploy without setting all required secrets
- Skip database migrations
- Disable security headers in production

### ✅ **DO**:
- Generate unique secrets for each environment
- Use wrangler secrets for all sensitive values
- Test deployments in staging first
- Monitor error logs after deployment
- Set up proper DNS and SSL certificates

## 📋 **Environment-Specific Configuration**

### Development
- Use `.env.local` with development-only secrets
- Local D1 database for testing
- Relaxed CORS for localhost development

### Staging
- Separate D1 database from production
- Staging-specific JWT secrets
- Limited access for testing

### Production
- Strong JWT secrets (64+ characters)
- Production D1 database with backups
- Strict CORS limited to production domains
- Full security headers and rate limiting

## 🛠️ **Troubleshooting Deployment Issues**

### Common Issues:
1. **"Database not found"** → Update database_id in wrangler.toml
2. **"JWT_SECRET not set"** → Run `wrangler secret put JWT_SECRET`
3. **"KV namespace not found"** → Create KV namespace and update ID
4. **CORS errors** → Check allowed origins in cors middleware

### Debug Commands:
```bash
# Check deployed secrets
wrangler secret list --env production

# View deployment logs
wrangler tail makanmakan-api-prod

# Test database connection
wrangler d1 execute makanmakan-prod --command "SELECT COUNT(*) FROM users"
```

---

**⚠️ Complete ALL steps above before deploying to production!**