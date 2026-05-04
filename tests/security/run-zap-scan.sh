#!/bin/bash

# OWASP ZAP Security Scanning Script
# Runs automated security tests against the application

set -e

# Configuration
ZAP_VERSION="2.14.0"
ZAP_PORT="8090"
TARGET_URL="${TARGET_URL:-http://localhost:4173}"
API_URL="${API_URL:-http://localhost:8787}"
REPORT_DIR="./security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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

# Check if ZAP is running
echo "📡 Checking ZAP daemon..."
if ! curl -s "http://localhost:$ZAP_PORT" > /dev/null 2>&1; then
    echo "${YELLOW}⚠️  ZAP daemon not running. Starting...${NC}"

    # Check if running in Docker
    if command -v docker &> /dev/null; then
        echo "🐳 Starting ZAP in Docker..."
        docker run -d --name zap \
            -p $ZAP_PORT:$ZAP_PORT \
            -v "$(pwd)":/zap/wrk/:rw \
            owasp/zap2docker-stable:$ZAP_VERSION \
            zap.sh -daemon -host 0.0.0.0 -port $ZAP_PORT \
            -config api.addrs.addr.name=.* \
            -config api.addrs.addr.regex=true \
            -config api.disablekey=true

        # Wait for ZAP to start
        echo "⏳ Waiting for ZAP to start..."
        sleep 15
    else
        echo "${RED}❌ Docker not found. Please install Docker or ZAP manually.${NC}"
        exit 1
    fi
fi

echo "${GREEN}✅ ZAP is running${NC}"
echo ""

# Function to run spider
run_spider() {
    local target=$1
    local context=$2

    echo "🕷️  Running Spider on $context..."

    # Start spider scan
    SPIDER_SCAN_ID=$(curl -s "http://localhost:$ZAP_PORT/JSON/spider/action/scan/?url=$target&contextName=$context" | jq -r '.scan')

    # Wait for spider to complete
    while true; do
        STATUS=$(curl -s "http://localhost:$ZAP_PORT/JSON/spider/view/status/?scanId=$SPIDER_SCAN_ID" | jq -r '.status')
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
    curl -s "http://localhost:$ZAP_PORT/JSON/ajaxSpider/action/scan/?url=$target&contextName=$context" > /dev/null

    # Wait for Ajax spider to complete
    while true; do
        STATUS=$(curl -s "http://localhost:$ZAP_PORT/JSON/ajaxSpider/view/status/" | jq -r '.status')

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
    SCAN_ID=$(curl -s "http://localhost:$ZAP_PORT/JSON/ascan/action/scan/?url=$target&contextName=$context" | jq -r '.scan')

    # Wait for scan to complete
    while true; do
        STATUS=$(curl -s "http://localhost:$ZAP_PORT/JSON/ascan/view/status/?scanId=$SCAN_ID" | jq -r '.status')
        echo "   Active Scan progress: $STATUS%"

        if [ "$STATUS" -eq 100 ]; then
            break
        fi

        sleep 5
    done

    echo "${GREEN}✅ Active Scan completed${NC}"
}

# Load ZAP configuration
echo "⚙️  Loading ZAP configuration..."
curl -s "http://localhost:$ZAP_PORT/JSON/core/action/loadSession/?name=makanmasak_session" > /dev/null || true

# Define contexts
echo "📋 Configuring contexts..."
curl -s "http://localhost:$ZAP_PORT/JSON/context/action/newContext/?contextName=Admin%20Dashboard" > /dev/null
curl -s "http://localhost:$ZAP_PORT/JSON/context/action/includeInContext/?contextName=Admin%20Dashboard&regex=$TARGET_URL.*" > /dev/null

curl -s "http://localhost:$ZAP_PORT/JSON/context/action/newContext/?contextName=API" > /dev/null
curl -s "http://localhost:$ZAP_PORT/JSON/context/action/includeInContext/?contextName=API&regex=$API_URL/api/v1/.*" > /dev/null

echo ""

# Scan Admin Dashboard
echo "=========================================="
echo "  Scanning Admin Dashboard"
echo "=========================================="
run_spider "$TARGET_URL" "Admin Dashboard"
run_ajax_spider "$TARGET_URL" "Admin Dashboard"
run_active_scan "$TARGET_URL" "Admin Dashboard"
echo ""

# Scan API
echo "=========================================="
echo "  Scanning API"
echo "=========================================="
run_spider "$API_URL/api/v1" "API"
run_active_scan "$API_URL/api/v1" "API"
echo ""

# Generate reports
echo "📄 Generating reports..."

# HTML Report
curl -s "http://localhost:$ZAP_PORT/OTHER/core/other/htmlreport/" > "$REPORT_DIR/zap-report-$TIMESTAMP.html"
echo "${GREEN}✅ HTML Report: $REPORT_DIR/zap-report-$TIMESTAMP.html${NC}"

# JSON Report
curl -s "http://localhost:$ZAP_PORT/JSON/core/view/alerts/" > "$REPORT_DIR/zap-alerts-$TIMESTAMP.json"
echo "${GREEN}✅ JSON Report: $REPORT_DIR/zap-alerts-$TIMESTAMP.json${NC}"

# XML Report
curl -s "http://localhost:$ZAP_PORT/OTHER/core/other/xmlreport/" > "$REPORT_DIR/zap-report-$TIMESTAMP.xml"
echo "${GREEN}✅ XML Report: $REPORT_DIR/zap-report-$TIMESTAMP.xml${NC}"

echo ""

# Analyze results
echo "=========================================="
echo "  Scan Results Summary"
echo "=========================================="

HIGH_ALERTS=$(curl -s "http://localhost:$ZAP_PORT/JSON/core/view/numberOfAlerts/?riskId=3" | jq -r '.numberOfAlerts')
MEDIUM_ALERTS=$(curl -s "http://localhost:$ZAP_PORT/JSON/core/view/numberOfAlerts/?riskId=2" | jq -r '.numberOfAlerts')
LOW_ALERTS=$(curl -s "http://localhost:$ZAP_PORT/JSON/core/view/numberOfAlerts/?riskId=1" | jq -r '.numberOfAlerts')
INFO_ALERTS=$(curl -s "http://localhost:$ZAP_PORT/JSON/core/view/numberOfAlerts/?riskId=0" | jq -r '.numberOfAlerts')

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
