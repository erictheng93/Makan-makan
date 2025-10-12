#!/bin/bash

# Test script for Shop QR Code API endpoints
# Base URL
BASE_URL="http://localhost:8787/api/v1"

echo "========================================="
echo "Testing Shop QR Code API Endpoints"
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

# Test 2: Generate shop QR code for restaurant ID 1
echo -e "${YELLOW}Test 2: Generate shop QR code${NC}"
GENERATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/restaurants/1/qr/shop/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $GENERATE_RESPONSE"
QR_CODE=$(echo $GENERATE_RESPONSE | grep -o '"qrCode":"[^"]*' | cut -d'"' -f4)

if [ -n "$QR_CODE" ]; then
  echo -e "${GREEN}✓ Shop QR code generated${NC}"
  echo "QR Code: $QR_CODE"
else
  echo -e "${RED}✗ Failed to generate shop QR code${NC}"
fi
echo ""

# Test 3: Get shop QR code info
echo -e "${YELLOW}Test 3: Get shop QR code info${NC}"
INFO_RESPONSE=$(curl -s -X GET "${BASE_URL}/restaurants/1/qr/shop" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $INFO_RESPONSE"
echo ""

# Test 4: Verify shop QR code (public endpoint, no auth required)
if [ -n "$QR_CODE" ]; then
  echo -e "${YELLOW}Test 4: Verify shop QR code (PUBLIC endpoint)${NC}"
  VERIFY_RESPONSE=$(curl -s -X GET "${BASE_URL}/qr-codes/verify/shop/$QR_CODE")

  echo "Response: $VERIFY_RESPONSE"

  if echo "$VERIFY_RESPONSE" | grep -q '"valid":true'; then
    echo -e "${GREEN}✓ QR code verified successfully${NC}"
  else
    echo -e "${RED}✗ QR code verification failed${NC}"
  fi
  echo ""
fi

# Test 5: Update shop mode settings
echo -e "${YELLOW}Test 5: Enable shop mode${NC}"
SHOP_MODE_RESPONSE=$(curl -s -X PUT "${BASE_URL}/restaurants/1/shop-mode" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "enabled": true,
    "settings": {
      "displayName": "Test Chicken Stall",
      "instructions": "Scan QR code to order",
      "requirePhone": true
    }
  }')

echo "Response: $SHOP_MODE_RESPONSE"

if echo "$SHOP_MODE_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Shop mode enabled successfully${NC}"
else
  echo -e "${RED}✗ Failed to enable shop mode${NC}"
fi
echo ""

# Test 6: Upload QR code image
echo -e "${YELLOW}Test 6: Upload QR code image URL${NC}"
UPLOAD_RESPONSE=$(curl -s -X POST "${BASE_URL}/restaurants/1/qr/shop/upload-image" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "imageUrl": "https://example.com/qr-code.png"
  }')

echo "Response: $UPLOAD_RESPONSE"

if echo "$UPLOAD_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ QR code image uploaded successfully${NC}"
else
  echo -e "${RED}✗ Failed to upload QR code image${NC}"
fi
echo ""

# Test 7: Regenerate shop QR code
echo -e "${YELLOW}Test 7: Regenerate shop QR code${NC}"
REGENERATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/restaurants/1/qr/shop/regenerate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $REGENERATE_RESPONSE"
NEW_QR_CODE=$(echo $REGENERATE_RESPONSE | grep -o '"qrCode":"[^"]*' | cut -d'"' -f4)

if [ -n "$NEW_QR_CODE" ]; then
  echo -e "${GREEN}✓ Shop QR code regenerated${NC}"
  echo "New QR Code: $NEW_QR_CODE"

  # Verify old QR code should still work (until explicitly deactivated)
  echo -e "${YELLOW}Test 7.1: Verify new QR code${NC}"
  VERIFY_NEW_RESPONSE=$(curl -s -X GET "${BASE_URL}/qr-codes/verify/shop/$NEW_QR_CODE")

  if echo "$VERIFY_NEW_RESPONSE" | grep -q '"valid":true'; then
    echo -e "${GREEN}✓ New QR code verified successfully${NC}"
  else
    echo -e "${RED}✗ New QR code verification failed${NC}"
  fi
else
  echo -e "${RED}✗ Failed to regenerate shop QR code${NC}"
fi
echo ""

echo "========================================="
echo "All tests completed!"
echo "========================================="
