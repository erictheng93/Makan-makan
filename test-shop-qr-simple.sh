#!/bin/bash

# Simplified test script for Shop QR Code API endpoints (GET only)
# Base URL
BASE_URL="http://localhost:8787/api/v1"

echo "========================================="
echo "Testing Shop QR Code API Endpoints (Simple)"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Login to get auth token
echo -e "${YELLOW}Test 1: Login to get auth token${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Login successful${NC}"
  echo "Token: ${TOKEN:0:20}..."
else
  echo -e "${RED}✗ Login failed${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi
echo ""

# Test 2: Get shop QR code info for restaurant ID 1
echo -e "${YELLOW}Test 2: Get shop QR code info${NC}"
INFO_RESPONSE=$(curl -s -X GET "${BASE_URL}/restaurants/1/qr/shop" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $INFO_RESPONSE"

if echo "$INFO_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Shop QR code info retrieved successfully${NC}"
else
  echo -e "${RED}✗ Failed to get shop QR code info${NC}"
  # Check if it's a method not found error
  if echo "$INFO_RESPONSE" | grep -q "is not a function"; then
    echo -e "${RED}  ERROR: Service method missing${NC}"
  fi
fi
echo ""

# Test 3: Verify public QR code endpoint (if QR code exists)
echo -e "${YELLOW}Test 3: Check if QR code verification endpoint exists${NC}"
VERIFY_RESPONSE=$(curl -s -X GET "${BASE_URL}/qr-codes/verify/shop/SHOP-1-1234567890")

echo "Response: $VERIFY_RESPONSE"

if echo "$VERIFY_RESPONSE" | grep -q '"valid"'; then
  echo -e "${GREEN}✓ QR code verification endpoint working${NC}"
else
  echo -e "${YELLOW}⚠ QR code verification response format unknown${NC}"
fi
echo ""

echo "========================================="
echo "Simple tests completed!"
echo "========================================="
