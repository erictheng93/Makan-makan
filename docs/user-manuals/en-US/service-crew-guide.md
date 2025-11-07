# 🚀 MakanMakan Service Crew Manual

> **Version**: 2.0
> **Last Updated**: 2025-10-26
> **Target Audience**: Restaurant Service Crew, Wait Staff

---

## 📚 Table of Contents

1. [Quick Start](#quick-start)
2. [System Overview](#system-overview)
3. [Login & Basic Operations](#login--basic-operations)
4. [Order Management](#order-management)
5. [Delivery Process](#delivery-process)
6. [Order Status Management](#order-status-management)
7. [Customer Service](#customer-service)
8. [Work Records](#work-records)
9. [Emergency Handling](#emergency-handling)
10. [FAQs](#faqs)

---

## 🚀 Quick Start

### Welcome to the MakanMakan Team!

As a service crew member, you are the vital bridge between the restaurant and customers. Your main responsibilities are:

```
┌─────────────────────────────────────────┐
│ Core Responsibilities                   │
├─────────────────────────────────────────┤
│                                         │
│  ✅ Receive and view new orders        │
│  ✅ Pick up meals from kitchen         │
│  ✅ Deliver to correct table/seat      │
│  ✅ Update delivery status             │
│  ✅ Respond to customer requests       │
│  ✅ Maintain service quality           │
│                                         │
└─────────────────────────────────────────┘
```

### Daily Workflow Overview

```
08:00 Login → Check schedule
   ↓
09:00 Prepare → Check utensils
   ↓
11:00 Service starts → Receive orders
   ↓
11:30 Peak hours → Fast delivery
   ↓
14:00 Break time → Clean environment
   ↓
17:00 Dinner prep → Recheck everything
   ↓
21:00 Closing → Record and report
   ↓
21:30 Sign out → Daily tasks complete
```

---

## 🏢 System Overview

### Your Role in the Team

```
        Owner
         │
    ┌────┼────┬────┐
    ↓    ↓    ↓    ↓
  Chef  Crew Cashier Customer
    │    │    │    │
    └────┴────┴────┘
         │
   Real-time Order System
```

**Role Explanation**:
- **Chef**: Prepares meals → Notifies pickup
- **You (Service Crew)**: Pick up → Deliver → Update status
- **Cashier**: Process payment → Complete order
- **Customer**: Order → Wait → Dine

### Permission Scope

```
┌─────────────────────────────────────────┐
│ Actions You Can Perform                 │
├─────────────────────────────────────────┤
│                                         │
│  ✅ View pending delivery orders       │
│  ✅ View order details                 │
│  ✅ Update order to "Delivering"       │
│  ✅ Update order to "Delivered"        │
│  ✅ View table information             │
│  ✅ View personal work records         │
│  ✅ Edit personal profile              │
│                                         │
│  ❌ Cannot modify menu prices          │
│  ❌ Cannot delete orders               │
│  ❌ Cannot view revenue                │
│  ❌ Cannot manage other employees      │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔐 Login & Basic Operations

### First Login Process

```
┌──────────────────────────────────────────┐
│ Login Steps                              │
├──────────────────────────────────────────┤
│                                          │
│  1️⃣ Open MakanMakan Service Crew App    │
│      ↓                                   │
│  2️⃣ Enter credentials from owner        │
│      ↓                                   │
│  3️⃣ Change password on first login      │
│      ↓                                   │
│  4️⃣ Complete personal profile           │
│      ↓                                   │
│  5️⃣ Enter service crew workspace        │
│                                          │
└──────────────────────────────────────────┘
```

### Login Credentials Example

| Item | Description | Example |
|------|-------------|---------|
| Username | Employee account created by owner | crew001 or your.email@example.com |
| Initial Password | Temporary password from owner | Temp123456 |
| New Password Requirements | At least 8 characters, letters and numbers | MyPass2025! |

### First Login Checklist

✅ **Change Default Password**
- Set secure and memorable password
- Do not share with others

✅ **Complete Personal Profile**
- Upload profile photo (optional)
- Fill in contact phone
- Confirm emergency contact

✅ **Familiarize with Interface**
- Browse main function areas
- Test order viewing function
- Understand status update methods

---

## 📋 Order Management

### Order Display Interface

```
┌─────────────────────────────────────────────┐
│ 🍽️ Pending Deliveries                     │
├─────────────────────────────────────────────┤
│                                             │
│  【Order #1234】                🔴 New      │
│  ┌─────────────────────────────────────┐   │
│  │ 🕐 11:23  📍 Table A3  👥 4 pax     │   │
│  │                                     │   │
│  │ 🍜 Beef Noodles x 2                │   │
│  │ 🥤 Iced Tea x 2                    │   │
│  │ 🍲 Mixed Appetizers x 1            │   │
│  │                                     │   │
│  │ 💬 Note: No spicy for beef noodles │   │
│  │                                     │   │
│  │ [🍳 Kitchen Done] [📦 Ready]       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  【Order #1235】                🟡 Cooking  │
│  ┌─────────────────────────────────────┐   │
│  │ 🕐 11:25  📍 Table B2  👥 2 pax     │   │
│  │                                     │   │
│  │ 🍛 Curry Rice x 1                  │   │
│  │ 🥗 Garden Salad x 1                │   │
│  │                                     │   │
│  │ [🍳 Kitchen Preparing]              │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### Order Status Explanation

```
┌─────────────────────────────────────────┐
│ Order Status Flow                       │
├─────────────────────────────────────────┤
│                                         │
│  🆕 New Order                          │
│   ↓                                     │
│  🍳 Kitchen Preparing (Chef)           │
│   ↓                                     │
│  ✅ Kitchen Done → 📦 Ready to Pick    │
│   ↓                                     │
│  🚶 Delivering (You)                   │
│   ↓                                     │
│  ✅ Delivered (You)                    │
│   ↓                                     │
│  💰 Paid (Cashier)                     │
│   ↓                                     │
│  🎉 Order Complete                     │
│                                         │
└─────────────────────────────────────────┘
```

### Order Information Guide

| Icon/Label | Meaning | Your Action |
|-----------|---------|-------------|
| 🔴 New Order | Just placed | Monitor kitchen progress |
| 🟡 Cooking | Kitchen preparing | Wait for pickup notification |
| 🟢 Ready | Meal completed | **Pick up immediately** |
| 🔵 Delivering | You are delivering | Deliver ASAP |
| ✅ Delivered | Meal delivered | Task complete |

### Order Filter Function

Navigate to: **Workspace → Order List → Filter**

```
Filter Options:
  ├─ 📦 Ready to Pick (Most used)
  ├─ 🚶 Delivering
  ├─ ✅ Completed Today
  ├─ 📍 Filter by Table
  └─ 🕐 Sort by Time
```

---

## 🍽️ Delivery Process

### Standard Delivery Steps

```
┌─────────────────────────────────────────────┐
│ Standard Delivery Process (SOP)             │
├─────────────────────────────────────────────┤
│                                             │
│  Step 1: Receive Pickup Notification       │
│  ─────────────────────────                  │
│   ✓ System shows "📦 Ready"                │
│   ✓ Check order number and table           │
│   ✓ Confirm meal items                     │
│                                             │
│  Step 2: Go to Kitchen to Pick Up          │
│  ─────────────────────────                  │
│   ✓ Confirm order number with chef         │
│   ✓ Verify items and quantity              │
│   ✓ Check meal appearance and temperature  │
│   ✓ Prepare utensils and condiments        │
│                                             │
│  Step 3: Update to "Delivering"            │
│  ─────────────────────────                  │
│   ✓ Click order card                       │
│   ✓ Select "🚶 Start Delivery"             │
│   ✓ System notifies customer "Delivering"  │
│                                             │
│  Step 4: Deliver to Table                  │
│  ─────────────────────────                  │
│   ✓ Confirm table/seat number              │
│   ✓ Greet customer politely                │
│   ✓ Place meal and explain                 │
│   ✓ Ask if anything else needed            │
│                                             │
│  Step 5: Confirm Delivered                 │
│  ─────────────────────────                  │
│   ✓ Click "✅ Delivered" button            │
│   ✓ System records completion time         │
│   ✓ Continue to next order                 │
│                                             │
└─────────────────────────────────────────────┘
```

### Pickup Checklist

When picking up from kitchen, verify:

| Check Item | Confirm Content |
|-----------|----------------|
| ✅ Order Number | Match system display |
| ✅ Meal Items | Verify name and quantity |
| ✅ Completeness | Side dishes, sauces, utensils |
| ✅ Meal Condition | Hot food hot, cold drinks cold |
| ✅ Appearance | Neat plating, no spills |
| ✅ Special Requests | Check notes (e.g., no spicy, vegetarian) |

### Delivery Service Etiquette

```
┌─────────────────────────────────────────┐
│ Service Etiquette                       │
├─────────────────────────────────────────┤
│                                         │
│  ✅ DO - Best Practices                │
│  ─────────────────                      │
│  • Smile & greet: "Hello, here's your  │
│    order"                              │
│  • Speak softly, don't disturb others  │
│  • Place carefully, avoid spills       │
│  • Introduce specials: "This is our    │
│    signature dish"                     │
│  • Ask proactively: "Anything else     │
│    needed?"                            │
│  • Wish well: "Enjoy your meal"        │
│                                         │
│  ❌ DON'T - Avoid These                │
│  ─────────────────────                  │
│  • Wrong table, didn't verify          │
│  • Cold attitude, no eye contact       │
│  • Rough handling of plates            │
│  • Forget utensils or condiments       │
│  • Don't update status after delivery  │
│  • Ignore customer questions           │
│                                         │
└─────────────────────────────────────────┘
```

### Multiple Order Delivery

When delivering multiple orders simultaneously:

```
Efficient Delivery Strategy:

  📍 Plan route by table zones
     │
     ├─ Zone A tables (A1-A5)
     ├─ Zone B tables (B1-B5)
     └─ Zone C tables (C1-C5)

  🎯 Batch pickup and delivery
     │
     ├─ Same zone → Deliver together
     ├─ Different zones → Separate batches
     └─ Hot food first → Maintain temperature
```

**Example**:

```
Scenario: 3 orders pending

Order #1234 → Table A3 → Beef Noodles (hot)
Order #1235 → Table A5 → Fried Rice (hot)
Order #1236 → Table B2 → Smoothie (cold)

✅ Best Strategy:
  1. Pick up A3, A5 hot food (same zone)
  2. Deliver A3 → A5 (efficient route)
  3. Return for B2 cold drink
  4. Deliver B2

⏱️ Time Saved: 5-10 minutes
```

---

## 🔄 Order Status Management

### How to Update Order Status

```
┌──────────────────────────────────────────┐
│ Update Order Status Steps                │
├──────────────────────────────────────────┤
│                                          │
│  Method 1: Direct update in order list   │
│  ───────────────────────────              │
│                                          │
│   [Order #1234]  [📦 Start Delivery]    │
│                      ↑                   │
│                  Click this button       │
│                                          │
│  Method 2: Update via order details      │
│  ───────────────────────────              │
│                                          │
│   [Order #1234] → Click to view details  │
│         ↓                                │
│   【Order Details Page】                 │
│   [Update Status: Delivering ▼]         │
│         ↓                                │
│   Select new status → Confirm            │
│                                          │
└──────────────────────────────────────────┘
```

### Status Update Timing

| Current Status | Update To | When |
|---------------|-----------|------|
| 🟢 Ready | 🚶 Delivering | **After pickup, before departing** |
| 🚶 Delivering | ✅ Delivered | **After placing meal on table** |

### Importance of Status Updates

```
Why update status promptly?

  1. 📱 Customer real-time tracking
     └─ Customer app shows delivery progress

  2. 🏢 Owner monitors efficiency
     └─ Admin dashboard analyzes delivery time

  3. 📊 System data statistics
     └─ Optimize staffing allocation

  4. 🤝 Team collaboration
     └─ Other staff understand situation
```

---

## 🤝 Customer Service

### Common Customer Requests

```
┌─────────────────────────────────────────┐
│ Customer Requests & Responses           │
├─────────────────────────────────────────┤
│                                         │
│  Request 1: "Can I have chopsticks?"    │
│  Response: "Sure, I'll get them now"    │
│  Action: Provide immediately            │
│                                         │
│  Request 2: "Where's my order?"         │
│  Response: "Sorry, let me check"        │
│  Action: Check status → Confirm kitchen │
│                                         │
│  Request 3: "This is too spicy, change?"│
│  Response: "Sorry, I'll get manager"    │
│  Action: Notify owner or supervisor     │
│                                         │
│  Request 4: "Can you take our photo?"   │
│  Response: "Of course!"                 │
│  Action: Help with photo, show warmth   │
│                                         │
│  Request 5: "We'd like to pay"          │
│  Response: "Sure, I'll call cashier"    │
│  Action: Notify cashier                 │
│                                         │
└─────────────────────────────────────────┘
```

### Service Attitude Standards

```
🌟 5 Keys to Excellent Service

  1️⃣ Smile
     └─ Always maintain friendly smile

  2️⃣ Eye Contact
     └─ Show you're listening attentively

  3️⃣ Quick Response
     └─ Respond within 30 seconds

  4️⃣ Clear Communication
     └─ Ensure customer understands

  5️⃣ Extra Care
     └─ Service beyond expectations
```

### Complaint Handling Steps

```
┌──────────────────────────────────────────┐
│ Customer Complaint Handling SOP          │
├──────────────────────────────────────────┤
│                                          │
│  Step 1: Listen & Apologize              │
│  ───────────────────                      │
│   • Don't interrupt, listen patiently    │
│   • Express apology: "Sorry for trouble" │
│                                          │
│  Step 2: Confirm Issue                   │
│  ───────────────────                      │
│   • Repeat issue: "You mean...right?"    │
│   • Ensure full understanding            │
│                                          │
│  Step 3: Propose Solution                │
│  ───────────────────                      │
│   • Minor issue: Handle immediately      │
│   • Major issue: Get supervisor          │
│                                          │
│  Step 4: Execute & Follow Up             │
│  ───────────────────                      │
│   • Quickly implement solution           │
│   • Confirm customer satisfaction        │
│                                          │
│  Step 5: Record & Report                 │
│  ───────────────────                      │
│   • Log incident in system               │
│   • Report serious issues to supervisor  │
│                                          │
└──────────────────────────────────────────┘
```

---

## 📊 Work Records

### View Personal Statistics

Navigate to: **Profile → Work Records**

```
┌─────────────────────────────────────────┐
│ 📊 This Week's Statistics              │
├─────────────────────────────────────────┤
│                                         │
│  🚀 Completed Orders: 127              │
│  ⏱️ Avg Delivery Time: 4.2 min        │
│  ⭐ Customer Rating: 4.8 / 5.0        │
│  🏆 Service Grade: Excellent           │
│                                         │
│  📈 Daily Delivery Trend               │
│  ───────────────────                    │
│   Mon: ████████░░ 18 orders           │
│   Tue: ██████████ 22 orders           │
│   Wed: ███████░░░ 15 orders           │
│   Thu: █████████░ 20 orders           │
│   Fri: ████████████ 28 orders         │
│   Sat: ██████████████ 32 orders       │
│   Sun: ████████░░ 16 orders           │
│                                         │
└─────────────────────────────────────────┘
```

### View Detailed Delivery Records

```
Delivery Record List
  │
  ├─ [2025-10-26 12:30] Order #1234
  │   └─ Table A3 → Time: 3m 45s ✅
  │
  ├─ [2025-10-26 12:45] Order #1235
  │   └─ Table B2 → Time: 4m 12s ✅
  │
  ├─ [2025-10-26 13:00] Order #1236
  │   └─ Table C5 → Time: 5m 30s ✅
  │
  └─ [2025-10-26 13:15] Order #1237
      └─ Table A1 → Time: 3m 20s ✅
```

### Performance Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Avg Delivery Time | From pickup to delivery | < 5 minutes |
| Completed Orders | Daily successful deliveries | Depends on shift |
| Customer Rating | Based on reviews | ≥ 4.5 / 5.0 |
| On-time Rate | Delivered within estimate | ≥ 95% |

---

## 🚨 Emergency Handling

### Common Emergency Situations

```
┌─────────────────────────────────────────┐
│ Emergency Response Guide                │
├─────────────────────────────────────────┤
│                                         │
│  Situation 1: Food spilled during       │
│               delivery                  │
│  ───────────────────────                │
│   1. Clean scene immediately            │
│   2. Notify kitchen to remake           │
│   3. Apologize to customer              │
│   4. Provide estimated wait time        │
│   5. Log incident and report            │
│                                         │
│  Situation 2: Wrong table delivery      │
│  ───────────────────────                │
│   1. Verify correct table number        │
│   2. Apologize to wrong table           │
│   3. Retrieve meal to correct table     │
│   4. Check if meal needs replacing      │
│                                         │
│  Situation 3: Customer unsatisfied      │
│  ───────────────────────                │
│   1. Listen and record issue            │
│   2. Notify supervisor immediately      │
│   3. Don't promise refund/replacement   │
│   4. Accompany supervisor to handle     │
│                                         │
│  Situation 4: System failure            │
│  ───────────────────────                │
│   1. Continue delivery service          │
│   2. Record order numbers on paper      │
│   3. Notify tech support or supervisor  │
│   4. Update records after recovery      │
│                                         │
│  Situation 5: Peak hour rush            │
│  ───────────────────────                │
│   1. Stay calm, handle orderly          │
│   2. Prioritize hot food                │
│   3. Batch process same zone orders     │
│   4. Request support if needed          │
│                                         │
└─────────────────────────────────────────┘
```

### Emergency Contacts

```
📞 Emergency Contact List
   │
   ├─ Manager/Supervisor: [Extension] or [Mobile]
   ├─ Head Chef: [Extension]
   ├─ Cashier: [Extension]
   └─ Tech Support: support@makanmakan.com
```

### Incident Reporting

For incidents requiring documentation:

Navigate to: **Profile → Incident Report**

```
Incident Report Form
  │
  ├─ Incident Type: [Dropdown]
  ├─ Time Occurred: [Auto-filled]
  ├─ Related Order: [Order Number]
  ├─ Description: [Detailed explanation]
  ├─ Action Taken: [Steps taken]
  └─ Photo Evidence: [Upload photo (optional)]
```

---

## ❓ FAQs

### Q1: What if I forget my password?

```
A: Password Reset Steps

  1. Click "Forgot Password" on login page
     ↓
  2. Enter your employee ID or email
     ↓
  3. System sends reset link to your email
     ↓
  4. Click link to set new password
     ↓
  5. If still unable, contact owner
```

---

### Q2: Order shows "Ready" but kitchen says not done?

```
A: Possible status update delay

  ✅ Correct Approach:
     • Confirm with chef
     • Trust chef's judgment
     • Wait for actual completion
     • Don't rush kitchen
     • Report if happens frequently
```

---

### Q3: Customer says order has error, what to do?

```
A: Order Error Handling

  Step 1: Check system order details
         └─ Confirm if customer error or system error

  Step 2: If customer ordered wrong
         └─ Politely explain "This is what you ordered"
         └─ Ask if they want to add more items
         └─ Guide to cashier for consultation

  Step 3: If kitchen made wrong
         └─ Apologize immediately
         └─ Notify kitchen to remake
         └─ Inform customer of wait time

  Step 4: Log incident
         └─ Add note in system
         └─ Brief report to supervisor
```

---

### Q4: Too many orders during peak, can't keep up?

```
A: Peak Hour Strategies

  🎯 Priority Strategy
     │
     ├─ Priority 1: Orders waiting > 10 min
     ├─ Priority 2: Hot food (avoid getting cold)
     ├─ Priority 3: Same zone multiple orders (batch)
     └─ Priority 4: Cold drinks, desserts

  🤝 Seek Help
     │
     ├─ Request other crew support
     ├─ Tell supervisor need manpower
     └─ Kitchen prioritize old orders

  💡 Improve Efficiency
     │
     ├─ Use tray to carry multiple orders
     ├─ Plan shortest delivery route
     └─ Reduce kitchen round trips
```

---

### Q5: Can I use my own phone to check orders?

```
A: Depends on restaurant policy

  ✅ If restaurant provides mobile app:
     • Can use your own phone
     • Download MakanMakan Service Crew App
     • Login with employee credentials
     • Ensure stable internet connection

  ⚠️ If using restaurant tablet:
     • Only use provided equipment
     • Don't install app privately
     • Don't login on personal devices
     • Follow information security policy
```

---

### Q6: Customer doesn't respond after delivery, still update "Delivered"?

```
A: Yes! Delivered = Update

  ✅ Correct Approach:
     • Meal on table = Delivered
     • No customer confirmation needed
     • Update status immediately
     • Continue to next order

  ℹ️ Explanation:
     • Customer sees delivery in app
     • Customer will call if issues
     • Don't delay for confirmation
```

---

### Q7: How to improve delivery speed?

```
A: Efficiency Improvement Tips

  ⚡ Speed Optimization Methods
     │
     ├─ 1. Memorize table layout
     │      └─ Know zone table locations
     │
     ├─ 2. Batch process orders
     │      └─ Same zone deliver multiple
     │
     ├─ 3. Prepare utensils ahead
     │      └─ Get everything during pickup
     │
     ├─ 4. Plan shortest route
     │      └─ Avoid detours
     │
     ├─ 5. Keep workspace organized
     │      └─ Reduce search time
     │
     └─ 6. Use tray or cart
            └─ Carry more meals at once

  📊 Target Setting
     • Avg delivery time: < 5 min
     • Pickup to delivery: < 3 min
     • Customer satisfaction: ≥ 4.5 stars
```

---

### Q8: Can I use phone during work?

```
A: Follow restaurant rules

  ✅ Allowed Uses:
     • Check orders on MakanMakan app
     • Emergency family contact
     • Answer supervisor calls
     • Work-related matters

  ❌ Not Allowed:
     • Browse social media during work
     • Chat, play games
     • Take selfies (unless allowed)
     • Any use affecting work efficiency

  📱 Usage Principle:
     • Free use during breaks
     • Work takes priority during shift
     • Request leave for emergencies
```

---

### Q9: Customer offers tip, can I accept?

```
A: Follow restaurant policy

  Plan A: Tips prohibited
     • Politely decline: "Thank you, it's our job"
     • Explain restaurant policy
     • If customer insists, ask supervisor

  Plan B: Tips allowed
     • Thank politely: "Thank you for encouragement"
     • Declare or submit as required
     • Follow tip distribution system

  ⚠️ Important:
     • Don't actively request tips
     • Don't change service attitude for tips
     • Provide quality service to all equally
```

---

### Q10: What if I encounter unfriendly customers?

```
A: Professional Response

  🛡️ Response Strategy
     │
     ├─ Stay calm
     │   └─ Don't respond emotionally
     │
     ├─ Professional attitude
     │   └─ Maintain politeness and respect
     │
     ├─ Listen to complaints
     │   └─ Let them finish
     │
     ├─ Apologize appropriately
     │   └─ "Sorry for the inconvenience"
     │
     ├─ Seek help
     │   └─ Ask supervisor to intervene
     │
     └─ Protect yourself
         └─ If verbal attack or threat, report immediately

  💬 Standard Response:
     "I apologize for the inconvenience.
      Let me get our supervisor to assist you."

  📝 Follow-up:
     • Log incident details
     • Report to supervisor
     • Don't take it personally, continue professionally
```

---

## 🎯 Secrets to Becoming an Excellent Service Crew

### Attitude & Mindset

```
┌─────────────────────────────────────────┐
│ Traits of Excellent Service Crew       │
├─────────────────────────────────────────┤
│                                         │
│  💪 Proactive                          │
│     └─ Find needs without being told   │
│                                         │
│  ⚡ Quick Response                     │
│     └─ Rapidly respond to customers    │
│                                         │
│  😊 Friendly                           │
│     └─ Genuine smile beats words       │
│                                         │
│  🎯 Attentive                          │
│     └─ Notice details, anticipate needs│
│                                         │
│  🤝 Teamwork                           │
│     └─ Collaborate with kitchen/cashier│
│                                         │
│  📚 Continuous Learning                │
│     └─ Familiarize with new menu/features│
│                                         │
│  💎 Professional Image                 │
│     └─ Neat appearance, proper conduct │
│                                         │
└─────────────────────────────────────────┘
```

### Career Development Path

```
Service Crew Career Ladder
   │
   ├─ Level 1: Junior Service Crew
   │   └─ Learn basic delivery process
   │
   ├─ Level 2: Senior Service Crew
   │   └─ Handle various situations independently
   │
   ├─ Level 3: Service Team Leader
   │   └─ Guide newcomers, coordinate work
   │
   ├─ Level 4: Floor Supervisor
   │   └─ Manage entire service team
   │
   └─ Level 5: Manager/Operations Manager
       └─ Overall restaurant operations
```

---

## 📞 Need Help?

### Internal Support

```
🆘 Help Request Order

  1️⃣ Senior Service Crew (Peer support)
     ↓
  2️⃣ Team Leader (On-site supervisor)
     ↓
  3️⃣ Manager (Overall management)
     ↓
  4️⃣ Tech Support (System issues)
```

### Contact Information

- **System/Tech Issues**: support@makanmakan.com
- **App Usage Issues**: In-system "Help Center"
- **Work-related Issues**: Contact your supervisor directly

---

## 🌟 Conclusion

Thank you for joining the MakanMakan team!

As service crew, you are the vital bridge connecting kitchen and customers. Every smile, every on-time delivery creates wonderful dining experiences.

Remember:
- ✨ **Attitude is everything** - Stay positive and enthusiastic
- 🚀 **Efficiency creates value** - Fast but steady
- 🤝 **Service from the heart** - Treat every customer sincerely
- 📈 **Continuous improvement** - Be better than yesterday

Wish you success and become the best service crew!

---

<div align="center">

**MakanMakan Service Crew Manual**

Making every service a wonderful experience

**Version 2.0** | **2025-10-26**

</div>
