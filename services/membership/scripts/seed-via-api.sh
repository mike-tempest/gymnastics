#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🌱 Seeding test data via API...${NC}\n"

API_URL="http://localhost:3000/api"

# Calculate tomorrow's date
TOMORROW=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d "+1 day" +%Y-%m-%d)
# Calculate dates for DBS
DBS_EXPIRY_25_DAYS=$(date -v+25d +%Y-%m-%d 2>/dev/null || date -d "+25 days" +%Y-%m-%d)
DBS_EXPIRY_5_DAYS=$(date -v+5d +%Y-%m-%d 2>/dev/null || date -d "+5 days" +%Y-%m-% d)
# Calculate dates for consents
CONSENT_EXPIRY_20_DAYS=$(date -v+20d +%Y-%m-%d 2>/dev/null || date -d "+20 days" +%Y-%m-%d)
CONSENT_EXPIRY_10_DAYS=$(date -v+10d +%Y-%m-%d 2>/dev/null || date -d "+10 days" +%Y-%m-%d)

echo -e "${GREEN}📋 Creating families...${NC}"
FAMILY1=$(curl -s -X POST "$API_URL/families" \
  -H "Content-Type: application/json" \
  -d '{
    "family_name": "Smith Family",
    "primary_contact_name": "Sarah Smith",
    "primary_contact_email": "sarah.smith@test.com",
    "primary_contact_phone": "07700 900123",
    "address_line1": "123 Main Street",
    "city": "London",
    "postcode": "SW1A 1AA"
  }')
FAMILY1_ID=$(echo $FAMILY1 | grep -o '"family_id":"[^"]*"' | cut -d'"' -f4)
echo "Created Smith Family (${FAMILY1_ID})"

FAMILY2=$(curl -s -X POST "$API_URL/families" \
  -H "Content-Type: application/json" \
  -d '{
    "family_name": "Johnson Family",
    "primary_contact_name": "Michael Johnson",
    "primary_contact_email": "michael.johnson@test.com",
    "primary_contact_phone": "07700 900456",
    "address_line1": "456 Oak Avenue",
    "city": "Manchester",
    "postcode": "M1 1AE"
  }')
FAMILY2_ID=$(echo $FAMILY2 | grep -o '"family_id":"[^"]*"' | cut -d'"' -f4)
echo -e "Created Johnson Family (${FAMILY2_ID})\n"

echo -e "${GREEN}🏊 Creating squads...${NC}"
SQUAD1=$(curl -s -X POST "$API_URL/squads" \
  -H "Content-Type: application/json" \
  -d '{
    "squad_name": "Junior Squad",
    "description": "Ages 8-12",
    "min_age": 8,
    "max_age": 12,
    "coach_name": "Coach Emma Williams",
    "training_times": "Monday & Wednesday 5:30-6:30pm",
    "max_capacity": 20
  }')
SQUAD1_ID=$(echo $SQUAD1 | grep -o '"squad_id":"[^"]*"' | cut -d'"' -f4)
echo "Created Junior Squad (${SQUAD1_ID})"

SQUAD2=$(curl -s -X POST "$API_URL/squads" \
  -H "Content-Type: application/json" \
  -d '{
    "squad_name": "Senior Squad",
    "description": "Ages 13-18",
    "min_age": 13,
    "max_age": 18,
    "coach_name": "Coach David Brown",
    "training_times": "Tuesday & Thursday 6:00-7:30pm",
    "max_capacity": 16
  }')
SQUAD2_ID=$(echo $SQUAD2 | grep -o '"squad_id":"[^"]*"' | cut -d'"' -f4)
echo -e "Created Senior Squad (${SQUAD2_ID})\n"

echo -e "${GREEN}👶 Creating swimmers...${NC}"
SWIMMER1=$(curl -s -X POST "$API_URL/swimmers" \
  -H "Content-Type: application/json" \
  -d "{
    \"family_id\": \"${FAMILY1_ID}\",
    \"first_name\": \"Emily\",
    \"last_name\": \"Smith\",
    \"dob\": \"2013-05-15\",
    \"gender\": \"Female\",
    \"se_number\": \"SE123456\",
    \"medical_notes\": \"No known allergies\"
  }")
SWIMMER1_ID=$(echo $SWIMMER1 | grep -o '"swimmer_id":"[^"]*"' | cut -d'"' -f4)
echo "Created Emily Smith (${SWIMMER1_ID})"

SWIMMER2=$(curl -s -X POST "$API_URL/swimmers" \
  -H "Content-Type: application/json" \
  -d "{
    \"family_id\": \"${FAMILY1_ID}\",
    \"first_name\": \"James\",
    \"last_name\": \"Smith\",
    \"dob\": \"2015-09-22\",
    \"gender\": \"Male\",
    \"se_number\": \"SE123457\"
  }")
SWIMMER2_ID=$(echo $SWIMMER2 | grep -o '"swimmer_id":"[^"]*"' | cut -d'"' -f4)
echo "Created James Smith (${SWIMMER2_ID})"

SWIMMER3=$(curl -s -X POST "$API_URL/swimmers" \
  -H "Content-Type: application/json" \
  -d "{
    \"family_id\": \"${FAMILY2_ID}\",
    \"first_name\": \"Olivia\",
    \"last_name\": \"Johnson\",
    \"dob\": \"2011-03-10\",
    \"gender\": \"Female\",
    \"se_number\": \"SE123458\"
  }")
SWIMMER3_ID=$(echo $SWIMMER3 | grep -o '"swimmer_id":"[^"]*"' | cut -d'"' -f4)
echo -e "Created Olivia Johnson (${SWIMMER3_ID})\n"

echo -e "${GREEN}🔗 Adding swimmers to squads...${NC}"
curl -s -X POST "$API_URL/squads/${SQUAD1_ID}/swimmers" \
  -H "Content-Type: application/json" \
  -d "{\"swimmerId\": \"${SWIMMER1_ID}\"}" > /dev/null
echo "Added Emily to Junior Squad"

curl -s -X POST "$API_URL/squads/${SQUAD1_ID}/swimmers" \
  -H "Content-Type: application/json" \
  -d "{\"swimmerId\": \"${SWIMMER2_ID}\"}" > /dev/null
echo "Added James to Junior Squad"

curl -s -X POST "$API_URL/squads/${SQUAD2_ID}/swimmers" \
  -H "Content-Type: application/json" \
  -d "{\"swimmerId\": \"${SWIMMER3_ID}\"}" > /dev/null
echo -e "Added Olivia to Senior Squad\n"

echo -e "${GREEN}📅 Creating sessions for tomorrow (${TOMORROW})...${NC}"
curl -s -X POST "$API_URL/sessions" \
  -H "Content-Type: application/json" \
  -d "{
    \"squad_id\": \"${SQUAD1_ID}\",
    \"session_name\": \"Junior Training\",
    \"session_date\": \"${TOMORROW}\",
    \"start_time\": \"17:30\",
    \"end_time\": \"18:30\",
    \"location\": \"Riverside Leisure Centre\",
    \"coach_name\": \"Coach Emma Williams\",
    \"description\": \"Focus on freestyle technique and endurance\",
    \"max_participants\": 20,
    \"status\": \"scheduled\"
  }" > /dev/null
echo "Created Junior Training session"

curl -s -X POST "$API_URL/sessions" \
  -H "Content-Type: application/json" \
  -d "{
    \"squad_id\": \"${SQUAD2_ID}\",
    \"session_name\": \"Senior Training\",
    \"session_date\": \"${TOMORROW}\",
    \"start_time\": \"18:00\",
    \"end_time\": \"19:30\",
    \"location\": \"Riverside Leisure Centre\",
    \"coach_name\": \"Coach David Brown\",
    \"description\": \"Sprint training and race preparation\",
    \"max_participants\": 16,
    \"status\": \"scheduled\"
  }" > /dev/null
echo -e "Created Senior Training session\n"

echo -e "${CYAN}✨ Test data seeding completed!${NC}\n"
echo -e "${GREEN}📊 Summary:${NC}"
echo "  - 2 families created"
echo "  - 3 swimmers created"
echo "  - 2 squads created"
echo "  - 2 sessions created for ${TOMORROW}"
echo ""
echo -e "${CYAN}📧 Test Emails:${NC}"
echo "  - sarah.smith@test.com (Smith Family - 2 swimmers in Junior Squad)"
echo "  - michael.johnson@test.com (Johnson Family - 1 swimmer in Senior Squad)"
echo ""
echo -e "${CYAN}🔗 Testing Endpoints:${NC}"
echo "  GET  http://localhost:3001/api/testing/info"
echo "  POST http://localhost:3001/api/testing/trigger-session-reminders"
echo "  POST http://localhost:3001/api/testing/trigger-dbs-reminders"
echo "  POST http://localhost:3001/api/testing/trigger-consent-reminders"
echo ""
echo -e "${CYAN}📬 MailHog:${NC} http://localhost:8025"
