# 🛡️ Security Deployment Checklist

## Pre-Deployment Security Verification

### ✅ Critical Security Tasks (MUST COMPLETE)

#### 1. Environment Variables & Secrets
- [ ] **JWT_SECRET is set and secure (minimum 32 characters)**
  ```bash
  # Generate new secret for each environment
  openssl rand -base64 48
  
  # Set via Wrangler (NOT in wrangler.toml)
  wrangler secret put JWT_SECRET --env production
  wrangler secret put JWT_SECRET --env staging
  ```

- [ ] **Database credentials are secure**
  - [ ] No hardcoded passwords in config.php
  - [ ] DB_PASSWORD set in environment variables
  - [ ] Database user has minimal required permissions

- [ ] **Cloudflare bindings configured**
  - [ ] D1 databases created and bound
  - [ ] KV namespaces created (CACHE_KV, TOKEN_BLACKLIST)
  - [ ] R2 buckets configured
  - [ ] All environment-specific IDs updated in wrangler.toml

#### 2. Password Security Migration
- [ ] **Database migration completed**
  ```bash
  # Run migration script
  sqlite3 makanmakan.db < SQL/migrate_passwords_security.sql
  
  # Or for D1
  npx wrangler d1 execute makanmakan-prod --file=packages/database/migrations/002_password_security_migration.sql
  ```

- [ ] **Password reset functionality implemented**
  - [ ] Password reset tokens table created
  - [ ] Password reset API endpoints working
  - [ ] Email notifications configured

- [ ] **User communication plan executed**
  - [ ] Users notified about password reset requirement
  - [ ] Documentation updated
  - [ ] Support team informed

#### 3. Authentication & Authorization
- [ ] **JWT configuration verified**
  - [ ] Token blacklisting working (logout invalidates tokens)
  - [ ] Token expiration warnings implemented
  - [ ] Error handling for expired/invalid tokens

- [ ] **Role-based access control tested**
  - [ ] Admin (role 0) permissions verified
  - [ ] Shop Owner (role 1) restrictions working
  - [ ] Staff roles (2-4) properly limited
  - [ ] Restaurant access isolation confirmed

#### 4. CORS & Security Headers
- [ ] **CORS configuration verified**
  ```bash
  # Test with curl
  curl -H "Origin: https://malicious-site.com" https://api.yourdomain.com/health
  # Should be blocked
  
  curl -H "Origin: https://admin.makanmakan.app" https://api.yourdomain.com/health  
  # Should be allowed
  ```

- [ ] **Security headers present**
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] X-XSS-Protection: 1; mode=block
  - [ ] Referrer-Policy: strict-origin-when-cross-origin

### 🔧 Deployment Commands

#### Development Setup
```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your actual values

# 3. Update database password in .env.local
DB_PASSWORD=your_actual_secure_password

# 4. Test locally
npm run dev
```

#### Staging Deployment
```bash
# 1. Set secrets
wrangler secret put JWT_SECRET --env staging
wrangler secret put SLACK_WEBHOOK_URL --env staging

# 2. Deploy API
cd apps/api
wrangler deploy --env staging

# 3. Deploy frontend apps
cd ../admin-dashboard
wrangler pages deploy --env staging

cd ../customer-app  
wrangler pages deploy --env staging

cd ../kitchen-display
wrangler pages deploy --env staging
```

#### Production Deployment
```bash
# 1. Run database migration
npx wrangler d1 execute makanmakan-prod --file=packages/database/migrations/002_password_security_migration.sql

# 2. Set production secrets
wrangler secret put JWT_SECRET --env production
wrangler secret put SLACK_WEBHOOK_URL --env production
wrangler secret put DB_PASSWORD --env production

# 3. Deploy all services
npm run deploy:prod
```

### 🧪 Security Testing Checklist

#### Authentication Testing
- [ ] **Login with bcrypt hashed password works**
- [ ] **Login with old plaintext password fails**
- [ ] **JWT token validation working**
- [ ] **Token blacklisting on logout functional**
- [ ] **Expired token properly rejected**

#### Authorization Testing  
- [ ] **Admin can access all restaurants**
- [ ] **Shop owner limited to their restaurant**
- [ ] **Staff cannot access admin functions**
- [ ] **Cross-restaurant access blocked**

#### Security Headers Testing
```bash
# Test security headers
curl -I https://api.yourdomain.com/health

# Should include:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
```

#### CORS Testing
```bash
# Test CORS restrictions
curl -H "Origin: https://unauthorized-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://api.yourdomain.com/auth/login
# Should be rejected

curl -H "Origin: https://admin.makanmakan.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://api.yourdomain.com/auth/login  
# Should be allowed
```

### 📊 Post-Deployment Monitoring

#### Immediate Monitoring (First 24 Hours)
- [ ] **API response times normal**
- [ ] **Authentication working across all apps**
- [ ] **Error rates within acceptable limits**
- [ ] **No security-related errors in logs**

#### Weekly Monitoring
- [ ] **Review audit_logs for suspicious activity**
- [ ] **Check failed authentication attempts**
- [ ] **Monitor JWT token blacklist size**
- [ ] **Verify password reset functionality**

#### Monthly Security Review
- [ ] **Rotate JWT secrets**
- [ ] **Update dependencies with security patches**
- [ ] **Review user account status**
- [ ] **Test backup and recovery procedures**

### 🚨 Emergency Procedures

#### Security Incident Response
1. **If JWT secret is compromised:**
   ```bash
   # Generate new secret
   NEW_SECRET=$(openssl rand -base64 48)
   
   # Update immediately
   wrangler secret put JWT_SECRET --env production
   echo $NEW_SECRET
   ```

2. **If database is compromised:**
   - Change database password immediately
   - Force password reset for all users
   - Review access logs
   - Contact security team

3. **If malicious activity detected:**
   - Check audit_logs table
   - Block suspicious IP addresses
   - Review CORS logs
   - Consider temporary API rate limiting

### 📋 Final Verification

#### Before Going Live
- [ ] **All secrets properly configured**
- [ ] **Database migration completed successfully** 
- [ ] **All security tests passing**
- [ ] **Monitoring and alerting configured**
- [ ] **Team trained on new security procedures**

#### User Communication
- [ ] **Password reset instructions sent**
- [ ] **Documentation updated**
- [ ] **Support team briefed**
- [ ] **Rollback plan prepared**

### 🔄 Rollback Plan

If critical issues arise:
```bash
# Emergency rollback for API
wrangler rollback --name makanmakan-api-prod

# Database rollback (if needed)
# Use backup created before migration
```

---

**Security Officer Sign-off**: [ ] _________________ Date: _________

**Technical Lead Sign-off**: [ ] _________________ Date: _________

**Deployment Date**: _____________

**Next Security Review**: _____________