#!/bin/bash

# =================================================================
# MakanMakan Security Setup Script
# =================================================================
# This script helps set up secure environment variables and secrets
# for all environments (development, staging, production)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛡️  MakanMakan Security Setup${NC}"
echo "================================================"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it first:${NC}"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Cloudflare. Please login first:${NC}"
    echo "wrangler login"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo

# Function to generate secure secret
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 48
    else
        # Fallback for systems without openssl
        head -c 48 /dev/urandom | base64
    fi
}

# Function to set secret for environment
set_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local env="$3"
    
    echo -e "${YELLOW}Setting $secret_name for $env environment...${NC}"
    
    if [ "$env" = "local" ]; then
        echo "export $secret_name=\"$secret_value\"" >> .env.local
        echo -e "${GREEN}✅ Added $secret_name to .env.local${NC}"
    else
        echo "$secret_value" | wrangler secret put "$secret_name" --env "$env"
        echo -e "${GREEN}✅ Set $secret_name for $env${NC}"
    fi
}

# Main setup function
main() {
    echo -e "${BLUE}🔑 Setting up JWT secrets...${NC}"
    
    # Generate JWT secrets for each environment
    JWT_SECRET_DEV=$(generate_secret)
    JWT_SECRET_STAGING=$(generate_secret)
    JWT_SECRET_PROD=$(generate_secret)
    
    echo -e "${YELLOW}Generated unique JWT secrets for all environments${NC}"
    echo
    
    # Create/update .env.local for development
    if [ ! -f .env.local ]; then
        cp .env.example .env.local
        echo -e "${GREEN}✅ Created .env.local from template${NC}"
    fi
    
    # Update JWT_SECRET in .env.local
    if grep -q "JWT_SECRET=" .env.local; then
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET_DEV|" .env.local
        echo -e "${GREEN}✅ Updated JWT_SECRET in .env.local${NC}"
    else
        echo "JWT_SECRET=$JWT_SECRET_DEV" >> .env.local
        echo -e "${GREEN}✅ Added JWT_SECRET to .env.local${NC}"
    fi
    
    # Set staging secrets
    read -p "🤔 Do you want to set up staging environment secrets? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        set_secret "JWT_SECRET" "$JWT_SECRET_STAGING" "staging"
        
        read -p "📧 Enter Slack webhook URL for staging (or press Enter to skip): " SLACK_URL_STAGING
        if [ ! -z "$SLACK_URL_STAGING" ]; then
            set_secret "SLACK_WEBHOOK_URL" "$SLACK_URL_STAGING" "staging"
        fi
    fi
    
    echo
    
    # Set production secrets
    read -p "🚨 Do you want to set up PRODUCTION environment secrets? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}⚠️  Setting up PRODUCTION secrets. Please be careful!${NC}"
        read -p "Are you sure? (yes/no): " confirm
        
        if [ "$confirm" = "yes" ]; then
            set_secret "JWT_SECRET" "$JWT_SECRET_PROD" "production"
            
            read -p "📧 Enter Slack webhook URL for production (or press Enter to skip): " SLACK_URL_PROD
            if [ ! -z "$SLACK_URL_PROD" ]; then
                set_secret "SLACK_WEBHOOK_URL" "$SLACK_URL_PROD" "production"
            fi
            
            read -p "🔐 Enter production database password (or press Enter to skip): " DB_PASSWORD_PROD
            if [ ! -z "$DB_PASSWORD_PROD" ]; then
                set_secret "DB_PASSWORD" "$DB_PASSWORD_PROD" "production"
            fi
        else
            echo -e "${YELLOW}⏭️  Skipped production setup${NC}"
        fi
    fi
    
    echo
    echo -e "${BLUE}📝 Next Steps:${NC}"
    echo "1. Update your database password in .env.local"
    echo "2. Create Cloudflare KV namespaces:"
    echo "   wrangler kv:namespace create 'TOKEN_BLACKLIST'"
    echo "   wrangler kv:namespace create 'CACHE_KV'"
    echo "3. Update wrangler.toml with the KV namespace IDs"
    echo "4. Run database migrations:"
    echo "   sqlite3 makanmakan.db < SQL/migrate_passwords_security.sql"
    echo "5. Test your setup with: npm run dev"
    
    echo
    echo -e "${GREEN}🎉 Security setup completed!${NC}"
    echo -e "${YELLOW}💡 Remember to:"
    echo "   - Never commit .env.local to version control"
    echo "   - Rotate secrets regularly (quarterly)"
    echo "   - Monitor your applications for security issues${NC}"
}

# Create KV namespaces function
create_kv_namespaces() {
    echo -e "${BLUE}🗄️  Creating KV Namespaces...${NC}"
    
    # Create development namespaces
    echo "Creating TOKEN_BLACKLIST namespace..."
    wrangler kv:namespace create "TOKEN_BLACKLIST" || true
    
    echo "Creating CACHE_KV namespace..."
    wrangler kv:namespace create "CACHE_KV" || true
    
    # Create staging namespaces
    echo "Creating staging TOKEN_BLACKLIST namespace..."
    wrangler kv:namespace create "TOKEN_BLACKLIST" --env staging || true
    
    echo "Creating staging CACHE_KV namespace..."
    wrangler kv:namespace create "CACHE_KV" --env staging || true
    
    # Create production namespaces
    read -p "🚨 Create production KV namespaces? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating production TOKEN_BLACKLIST namespace..."
        wrangler kv:namespace create "TOKEN_BLACKLIST" --env production || true
        
        echo "Creating production CACHE_KV namespace..."
        wrangler kv:namespace create "CACHE_KV" --env production || true
    fi
    
    echo -e "${GREEN}✅ KV namespaces created${NC}"
    echo -e "${YELLOW}💡 Don't forget to update the namespace IDs in wrangler.toml${NC}"
}

# Check arguments
if [ "$1" = "--kv-only" ]; then
    create_kv_namespaces
    exit 0
fi

if [ "$1" = "--help" ]; then
    echo "Usage: $0 [--kv-only] [--help]"
    echo
    echo "Options:"
    echo "  --kv-only    Only create KV namespaces"
    echo "  --help       Show this help message"
    exit 0
fi

# Run main setup
main

# Ask if user wants to create KV namespaces
echo
read -p "🗄️  Do you want to create KV namespaces now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    create_kv_namespaces
fi

echo
echo -e "${GREEN}🔒 Setup complete! Your MakanMakan application is now secured.${NC}"