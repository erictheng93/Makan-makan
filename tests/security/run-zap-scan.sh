#!/bin/bash

# OWASP ZAP Security Scanning Script
# Runs automated security tests against the application

set -e

# Configuration
ZAP_IMAGE="${ZAP_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}"
ZAP_PORT="8090"
TARGET_URL="${TARGET_URL:-http://localhost:4173}"
API_URL="${API_URL:-http://localhost:8787}"
REPORT_DIR="./security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ZAP_SESSION_NAME="${ZAP_SESSION_NAME:-makanmakan_${TIMESTAMP}}"
ZAP_AUTH_USERNAME="${ZAP_AUTH_USERNAME:-${SMOKE_AUTH_USERNAME:-}}"
ZAP_AUTH_PASSWORD="${ZAP_AUTH_PASSWORD:-${SMOKE_AUTH_PASSWORD:-}}"
ZAP_API_SEED_PATHS="${ZAP_API_SEED_PATHS:-/api/v1 /api/v1/info /api/v1/orders}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "  OWASP ZAP Security Scan"
echo "=========================================="
echo ""

# Create report directory
mkdir -p "$REPORT_DIR"

normalize_for_zap() {
    local url=$1
    echo "$url" | sed -E 's#://localhost(:[0-9]+)?#://host.docker.internal\1#; s#://127\.0\.0\.1(:[0-9]+)?#://host.docker.internal\1#'
}

ZAP_TARGET_URL="${ZAP_TARGET_URL:-$(normalize_for_zap "$TARGET_URL")}"
ZAP_API_URL="${ZAP_API_URL:-$(normalize_for_zap "$API_URL")}"

zap_api() {
    local path=$1
    shift
    curl -fsS -G "http://localhost:$ZAP_PORT$path" "$@"
}

zap_api_optional() {
    local path=$1
    shift
    curl -s -G "http://localhost:$ZAP_PORT$path" "$@" > /dev/null || true
}

# Check if ZAP is running
echo "📡 Checking ZAP daemon..."
if ! curl -s "http://localhost:$ZAP_PORT" > /dev/null 2>&1; then
    echo "${YELLOW}⚠️  ZAP daemon not running. Starting...${NC}"

    # Check if running in Docker
    if command -v docker &> /dev/null; then
        echo "🐳 Starting ZAP in Docker..."
        docker run -d --name zap \
            -p $ZAP_PORT:$ZAP_PORT \
            --add-host=host.docker.internal:host-gateway \
            -v "$(pwd)":/zap/wrk/:rw \
            "$ZAP_IMAGE" \
            zap.sh -daemon -host 0.0.0.0 -port $ZAP_PORT \
            -config api.addrs.addr.name=.* \
            -config api.addrs.addr.regex=true \
            -config api.disablekey=true

        echo "⏳ Waiting for ZAP to start..."
    else
        echo "${RED}❌ Docker not found. Please install Docker or ZAP manually.${NC}"
        exit 1
    fi
fi

for i in {1..60}; do
    if curl -fsS "http://localhost:$ZAP_PORT/JSON/core/view/version/" > /dev/null 2>&1; then
        break
    fi

    if [ "$i" -eq 60 ]; then
        echo "${RED}❌ ZAP API did not become ready in time.${NC}"
        exit 1
    fi

    sleep 2
done

echo "${GREEN}✅ ZAP is running${NC}"
echo ""

echo "🎯 Scan targets:"
echo "   Dashboard: $TARGET_URL (ZAP: $ZAP_TARGET_URL)"
echo "   API:       $API_URL (ZAP: $ZAP_API_URL)"
echo ""

# Function to run spider
run_spider() {
    local target=$1
    local context=$2

    echo "🕷️  Running Spider on $context..."

    # Start spider scan
    SPIDER_SCAN_ID=$(zap_api "/JSON/spider/action/scan/" \
        --data-urlencode "contextName=$context" \
        --data-urlencode "subtreeOnly=true" \
        --data-urlencode "url=$target" | jq -r '.scan')
    if [ -z "$SPIDER_SCAN_ID" ] || [ "$SPIDER_SCAN_ID" = "null" ]; then
        echo "${RED}❌ Failed to start spider for $target${NC}"
        exit 1
    fi

    # Wait for spider to complete
    while true; do
        STATUS=$(zap_api "/JSON/spider/view/status/" --data-urlencode "scanId=$SPIDER_SCAN_ID" | jq -r '.status')
        echo "   Spider progress: $STATUS%"

        if [ "$STATUS" -eq 100 ]; then
            break
        fi

        sleep 2
    done

    echo "${GREEN}✅ Spider completed${NC}"
}

# Function to run Ajax Spider
run_ajax_spider() {
    local target=$1
    local context=$2

    echo "🌐 Running Ajax Spider on $context..."

    # Start Ajax spider
    zap_api "/JSON/ajaxSpider/action/scan/" \
        --data-urlencode "contextName=$context" \
        --data-urlencode "inScope=true" \
        --data-urlencode "url=$target" > /dev/null

    # Wait for Ajax spider to complete
    while true; do
        STATUS=$(zap_api "/JSON/ajaxSpider/view/status/" | jq -r '.status')

        if [ "$STATUS" == "stopped" ]; then
            break
        fi

        echo "   Ajax Spider status: $STATUS"
        sleep 3
    done

    echo "${GREEN}✅ Ajax Spider completed${NC}"
}

# Function to run active scan
run_active_scan() {
    local target=$1
    local context=$2

    echo "🔍 Running Active Scan on $context..."

    # Start active scan
    SCAN_ID=$(zap_api "/JSON/ascan/action/scan/" \
        --data-urlencode "contextId=$context" \
        --data-urlencode "recurse=true" \
        --data-urlencode "inScopeOnly=true" \
        --data-urlencode "url=$target" | jq -r '.scan')
    if [ -z "$SCAN_ID" ] || [ "$SCAN_ID" = "null" ]; then
        echo "${RED}❌ Failed to start active scan for $target${NC}"
        exit 1
    fi

    # Wait for scan to complete
    while true; do
        STATUS=$(zap_api "/JSON/ascan/view/status/" --data-urlencode "scanId=$SCAN_ID" | jq -r '.status')
        echo "   Active Scan progress: $STATUS%"

        if [ "$STATUS" -eq 100 ]; then
            break
        fi

        sleep 5
    done

    echo "${GREEN}✅ Active Scan completed${NC}"
}

configure_auth_header() {
    if [ -z "$ZAP_AUTH_USERNAME" ] || [ -z "$ZAP_AUTH_PASSWORD" ]; then
        echo "${YELLOW}⚠️  No ZAP_AUTH_USERNAME/ZAP_AUTH_PASSWORD provided; authenticated API scan will be skipped.${NC}"
        return
    fi

    echo "🔐 Fetching API token for authenticated scan..."
    local login_response
    if ! login_response=$(curl -fsS "$API_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        --data "{\"username\":\"$ZAP_AUTH_USERNAME\",\"password\":\"$ZAP_AUTH_PASSWORD\"}"); then
        echo "${YELLOW}⚠️  Login failed; continuing unauthenticated ZAP scan.${NC}"
        return
    fi

    local token
    token=$(echo "$login_response" | jq -r '.data.token // .token // empty')
    if [ -z "$token" ]; then
        echo "${YELLOW}⚠️  Login response did not include a token; continuing unauthenticated ZAP scan.${NC}"
        return
    fi

    zap_api_optional "/JSON/replacer/action/removeRule/" \
        --data-urlencode "description=MakanMakan API bearer token"
    zap_api "/JSON/replacer/action/addRule/" \
        --data-urlencode "description=MakanMakan API bearer token" \
        --data-urlencode "enabled=true" \
        --data-urlencode "matchType=REQ_HEADER" \
        --data-urlencode "matchRegex=false" \
        --data-urlencode "matchString=Authorization" \
        --data-urlencode "replacement=Bearer $token" > /dev/null

    echo "${GREEN}✅ Authenticated API scan header configured${NC}"
}

seed_api_urls() {
    for path in $ZAP_API_SEED_PATHS; do
        zap_api_optional "/JSON/core/action/accessUrl/" \
            --data-urlencode "url=$ZAP_API_URL$path" \
            --data-urlencode "followRedirects=true"
    done
}

delete_out_of_scope_sites() {
    echo "🧹 Removing out-of-scope sites before report generation..."
    local sites
    sites=$(zap_api "/JSON/core/view/sites/" | jq -r '.sites[]?')

    while IFS= read -r site; do
        if [ -z "$site" ]; then
            continue
        fi

        case "$site" in
            "$ZAP_TARGET_URL"*|"$ZAP_API_URL"*)
                ;;
            *)
                echo "   Removing $site"
                zap_api_optional "/JSON/core/action/deleteSiteNode/" \
                    --data-urlencode "url=$site" \
                    --data-urlencode "method=" \
                    --data-urlencode "postData="
                ;;
        esac
    done <<< "$sites"
}

assert_scanned_scope() {
    local target_count api_count
    target_count=$(zap_api "/JSON/core/view/urls/" --data-urlencode "baseurl=$ZAP_TARGET_URL" | jq '.urls | length')
    api_count=$(zap_api "/JSON/core/view/urls/" --data-urlencode "baseurl=$ZAP_API_URL" | jq '.urls | length')

    echo "📌 In-scope URL coverage:"
    echo "   Dashboard URLs: $target_count"
    echo "   API URLs:       $api_count"

    if [ "$target_count" -eq 0 ] || [ "$api_count" -eq 0 ]; then
        echo "${RED}❌ SCAN FAILED: ZAP did not crawl both dashboard and API scopes.${NC}"
        exit 1
    fi
}

echo "⚙️  Creating fresh ZAP session..."
zap_api_optional "/JSON/core/action/newSession/" \
    --data-urlencode "name=$ZAP_SESSION_NAME" \
    --data-urlencode "overwrite=true"
zap_api_optional "/JSON/core/action/deleteAllAlerts/"

# Define contexts
echo "📋 Configuring contexts..."
ADMIN_CONTEXT_ID=$(zap_api "/JSON/context/action/newContext/" --data-urlencode "contextName=Admin Dashboard" | jq -r '.contextId')
zap_api "/JSON/context/action/includeInContext/" \
    --data-urlencode "contextName=Admin Dashboard" \
    --data-urlencode "regex=\\Q$ZAP_TARGET_URL\\E.*" > /dev/null
zap_api "/JSON/context/action/setContextInScope/" \
    --data-urlencode "contextName=Admin Dashboard" \
    --data-urlencode "booleanInScope=true" > /dev/null

API_CONTEXT_ID=$(zap_api "/JSON/context/action/newContext/" --data-urlencode "contextName=API" | jq -r '.contextId')
zap_api "/JSON/context/action/includeInContext/" \
    --data-urlencode "contextName=API" \
    --data-urlencode "regex=\\Q$ZAP_API_URL/api/v1\\E.*" > /dev/null
zap_api "/JSON/context/action/setContextInScope/" \
    --data-urlencode "contextName=API" \
    --data-urlencode "booleanInScope=true" > /dev/null

configure_auth_header
seed_api_urls

echo ""

# Scan Admin Dashboard
echo "=========================================="
echo "  Scanning Admin Dashboard"
echo "=========================================="
run_spider "$ZAP_TARGET_URL" "Admin Dashboard"
run_ajax_spider "$ZAP_TARGET_URL" "Admin Dashboard"
run_active_scan "$ZAP_TARGET_URL" "$ADMIN_CONTEXT_ID"
echo ""

# Scan API
echo "=========================================="
echo "  Scanning API"
echo "=========================================="
run_spider "$ZAP_API_URL/api/v1" "API"
run_active_scan "$ZAP_API_URL/api/v1" "$API_CONTEXT_ID"
echo ""

delete_out_of_scope_sites
assert_scanned_scope

# Generate reports
echo "📄 Generating reports..."

# HTML Report
curl -fsS "http://localhost:$ZAP_PORT/OTHER/core/other/htmlreport/" > "$REPORT_DIR/zap-report-$TIMESTAMP.html"
echo "${GREEN}✅ HTML Report: $REPORT_DIR/zap-report-$TIMESTAMP.html${NC}"

# JSON Report
curl -fsS "http://localhost:$ZAP_PORT/JSON/core/view/alerts/" |
    jq --arg dashboard "$ZAP_TARGET_URL" --arg api "$ZAP_API_URL" \
        '{alerts: [.alerts[] | select((.url | startswith($dashboard)) or (.url | startswith($api)))]}' \
        > "$REPORT_DIR/zap-alerts-$TIMESTAMP.json"
echo "${GREEN}✅ JSON Report: $REPORT_DIR/zap-alerts-$TIMESTAMP.json${NC}"

# XML Report
curl -fsS "http://localhost:$ZAP_PORT/OTHER/core/other/xmlreport/" > "$REPORT_DIR/zap-report-$TIMESTAMP.xml"
echo "${GREEN}✅ XML Report: $REPORT_DIR/zap-report-$TIMESTAMP.xml${NC}"

echo ""

# Analyze results
echo "=========================================="
echo "  Scan Results Summary"
echo "=========================================="

HIGH_ALERTS=$(jq '[.alerts[] | select(.risk=="High")] | length' "$REPORT_DIR/zap-alerts-$TIMESTAMP.json")
MEDIUM_ALERTS=$(jq '[.alerts[] | select(.risk=="Medium")] | length' "$REPORT_DIR/zap-alerts-$TIMESTAMP.json")
LOW_ALERTS=$(jq '[.alerts[] | select(.risk=="Low")] | length' "$REPORT_DIR/zap-alerts-$TIMESTAMP.json")
INFO_ALERTS=$(jq '[.alerts[] | select(.risk=="Informational")] | length' "$REPORT_DIR/zap-alerts-$TIMESTAMP.json")

echo ""
echo "🔴 High Risk:   $HIGH_ALERTS"
echo "🟡 Medium Risk: $MEDIUM_ALERTS"
echo "🟢 Low Risk:    $LOW_ALERTS"
echo "ℹ️  Info:        $INFO_ALERTS"
echo ""

# Check if scan passed
EXIT_CODE=0

if [ "$HIGH_ALERTS" -gt 0 ]; then
    echo "${RED}❌ SCAN FAILED: High risk vulnerabilities found${NC}"
    EXIT_CODE=1
elif [ "$MEDIUM_ALERTS" -gt 10 ]; then
    echo "${RED}❌ SCAN FAILED: Too many medium risk vulnerabilities ($MEDIUM_ALERTS > 10)${NC}"
    EXIT_CODE=1
elif [ "$MEDIUM_ALERTS" -gt 0 ]; then
    echo "${YELLOW}⚠️  WARNING: Medium risk vulnerabilities found${NC}"
else
    echo "${GREEN}✅ SCAN PASSED: No critical vulnerabilities found${NC}"
fi

echo ""
echo "📊 Full reports available in: $REPORT_DIR/"
echo ""

# Cleanup (optional)
if [ "${ZAP_CLEANUP:-false}" == "true" ]; then
    echo "🧹 Cleaning up..."
    docker stop zap > /dev/null 2>&1 || true
    docker rm zap > /dev/null 2>&1 || true
fi

exit $EXIT_CODE
