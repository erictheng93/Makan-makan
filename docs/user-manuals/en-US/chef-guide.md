# 👨‍🍳 MakanMakan Chef Operations Manual

> **Version**: 2.0
> **Last Updated**: 2025-10-26
> **Target Audience**: Kitchen Staff, Chefs, Head Cooks

---

## 📚 Table of Contents

1. [Quick Start](#quick-start)
2. [System Overview](#system-overview)
3. [Kitchen Display System Interface](#kitchen-display-system-interface)
4. [Login and Basic Operations](#login-and-basic-operations)
5. [Order Reception Process](#order-reception-process)
6. [Order Status Management](#order-status-management)
7. [Multi-Order Processing](#multi-order-processing)
8. [Priority Management](#priority-management)
9. [Special Situation Handling](#special-situation-handling)
10. [Team Collaboration](#team-collaboration)
11. [Efficiency Tips](#efficiency-tips)
12. [Frequently Asked Questions](#frequently-asked-questions)
13. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Core Responsibilities of a Chef

```
┌─────────────────────────────────────────────┐
│ Chef Workflow                               │
├─────────────────────────────────────────────┤
│                                             │
│  1️⃣ Receive new orders                     │
│      ↓                                      │
│  2️⃣ Confirm order details                  │
│      ↓                                      │
│  3️⃣ Update to "Preparing"                  │
│      ↓                                      │
│  4️⃣ Start cooking                          │
│      ↓                                      │
│  5️⃣ Update to "Ready" when done            │
│      ↓                                      │
│  6️⃣ Notify service crew for pickup         │
│                                             │
└─────────────────────────────────────────────┘
```

### First-Time Setup Checklist

✅ **Step 1: Confirm Account & Equipment**

- Verify chef account credentials
- Test login to kitchen display system
- Ensure display screen functions properly

✅ **Step 2: Familiarize with Interface**

- Understand order card layout
- Practice status update operations
- Test sound notifications

✅ **Step 3: Learn the Process**

- New order notification methods
- Status update procedures
- Order completion workflow

✅ **Step 4: Preparation**

- Confirm kitchen equipment ready
- Check ingredient preparation
- Start receiving orders

---

## 🏢 System Overview

### Kitchen Display System Position

```
┌─────────────────────────────────────────────────────────┐
│ MakanMakan Kitchen Ecosystem                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Customer Order ───→ Order System ───→ Kitchen Display │
│                           ↓              ↓        ↓     │
│                      Owner Monitor   【You Are Here】   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Kitchen Role Collaboration Model

```
        Order Source
           │
    ┌──────┴──────┐
    ↓             ↓
  Table Order  Shop Order
    │             │
    └──────┬──────┘
           ↓
   【Kitchen Display System】
     (Your Workstation)
           │
    ┌──────┴──────┐
    ↓             ↓
Service Crew   Customer App
Confirm Delivery  Real-time Track
```

**Explanation**:

- **Customer**: Orders via QR Code
- **Kitchen System**: Receives and displays orders in real-time
- **Chef (You)**: Process orders and update status
- **Service Crew**: Pick up and deliver to customers
- **Owner**: Monitor overall operations

---

## 🖥️ Kitchen Display System Interface

### Main Screen Layout

```
┌───────────────────────────────────────────────────────────┐
│  🏪 Restaurant Name    👨‍🍳 Chef: John     🕐 14:35       │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  【Pending】        【Preparing】      【Ready】          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ #001     │    │ #002     │    │ #003     │          │
│  │ Table: 5 │    │ Table: 3 │    │ Table: 8 │          │
│  │ Time:    │    │ Time:    │    │ Time:    │          │
│  │ 14:30    │    │ 14:25    │    │ 14:20    │          │
│  │          │    │          │    │          │          │
│  │ Items:   │    │ Items:   │    │ Items:   │          │
│  │ • Steak  │    │ • Pasta  │    │ • Salad  │          │
│  │ • Salad  │    │ • Soup   │    │ • Soup   │          │
│  │          │    │          │    │          │          │
│  │ [Start]  │    │ [Done]   │    │ ✓ Ready  │          │
│  └──────────┘    └──────────┘    └──────────┘          │
│                                                           │
│  ┌──────────┐                                            │
│  │ #004     │                                            │
│  │ Table: 12│                                            │
│  │ Time:    │                                            │
│  │ 14:32 🔔 │    (New Order Alert)                      │
│  │          │                                            │
│  │ Items:   │                                            │
│  │ • Curry  │                                            │
│  │ • Drink  │                                            │
│  │          │                                            │
│  │ [Start]  │                                            │
│  └──────────┘                                            │
│                                                           │
├───────────────────────────────────────────────────────────┤
│  📊 Today: 23 Done | 5 In Progress | 2 Pending          │
└───────────────────────────────────────────────────────────┘
```

### Order Card Detailed Explanation

```
┌─────────────────────────────┐
│ Order Card Structure        │
├─────────────────────────────┤
│                             │
│  🔢 Order Number: #001      │
│  ├─ Quick identification    │
│  └─ Synced with customer    │
│                             │
│  🪑 Table/Seat: Table 5     │
│  ├─ Clear delivery location │
│  └─ Avoid delivery mistakes │
│                             │
│  ⏰ Order Time: 14:30       │
│  ├─ Track waiting time      │
│  └─ Priority reference      │
│                             │
│  📋 Order Items:            │
│  ├─ Steak x1 (medium rare)  │
│  ├─ Caesar Salad x1         │
│  └─ Corn Soup x2            │
│                             │
│  💬 Note: No onions         │
│  └─ Special requirements    │
│                             │
│  🎯 Status Button: [Start]  │
│  └─ One-click status update │
│                             │
└─────────────────────────────┘
```

### Color Coding System

```
┌─────────────────────────────────────────┐
│ Visual Indicator System                 │
├─────────────────────────────────────────┤
│                                         │
│  🟦 Blue = New Order (Pending)         │
│  └─ Not yet started                    │
│                                         │
│  🟨 Yellow = Preparing                 │
│  └─ Currently cooking                  │
│                                         │
│  🟩 Green = Ready                      │
│  └─ Ready for service                  │
│                                         │
│  🟥 Red = Waiting > 15 minutes         │
│  └─ Requires priority attention        │
│                                         │
│  🔔 Blinking = New order arrived       │
│  └─ With sound notification            │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔐 Login and Basic Operations

### Login Process

**Step 1: Open Kitchen Display System**

Navigate to: Kitchen tablet or display system URL

```
Example URL:
https://kitchen.makanmakan.com
or
https://your-restaurant.makanmakan.com/kitchen
```

**Step 2: Enter Chef Credentials**

```
┌─────────────────────────────┐
│  👨‍🍳 Kitchen System Login   │
├─────────────────────────────┤
│                             │
│  Username: [chef001____]    │
│  Password: [**********]     │
│                             │
│  ☐ Remember Me (Workstation)│
│                             │
│  [    Login System    ]     │
│                             │
└─────────────────────────────┘
```

**Step 3: Select Workstation (If Applicable)**

Some restaurants have multiple kitchen stations (e.g., Cold Kitchen, Wok Station, Grill Station)

```
Select Your Workstation:
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Cold     │  │ Wok      │  │ Grill    │
│ Kitchen  │  │ Station  │  │ Station  │
│          │  │          │  │          │
│ Shows:   │  │ Shows:   │  │ Shows:   │
│ Salads,  │  │ Fried    │  │ Steaks,  │
│ Apps     │  │ Rice     │  │ Roasts   │
└──────────┘  └──────────┘  └──────────┘
```

### Post-Login Checklist

✅ **System Status Verification**

```
┌─────────────────────────────┐
│ System Checklist            │
├─────────────────────────────┤
│ ✓ Network connection OK     │
│ ✓ Real-time updates active  │
│ ✓ Sound notifications ON    │
│ ✓ Screen brightness optimal │
│ ✓ Today's menu loaded       │
└─────────────────────────────┘
```

### Basic Settings Adjustment

**Sound Settings**

Click ⚙️ Settings icon in top right:

```
🔊 New Order Alert:
├─ 🔔 Standard Bell
├─ 📢 Loud Alert
├─ 🎵 Soft Music
└─ 🔇 Silent Mode

Volume: ▓▓▓▓▓▓▓▓░░ (80%)
```

**Display Settings**

```
📺 Display Mode:
├─ 📱 Compact (Small Screen)
├─ 🖥️  Standard (Medium Screen)
└─ 📺 Kitchen Mode (Large Screen)

Font Size:
├─ Standard (Recommended)
├─ Large (For Reading Glasses)
└─ Extra Large (Distance Viewing)
```

---

## 📥 Order Reception Process

### New Order Notification Mechanism

```
┌─────────────────────────────────────────┐
│ New Order Arrival Notifications         │
├─────────────────────────────────────────┤
│                                         │
│  Method 1: 🔔 Sound Alert              │
│  ├─ Default "Ding Dong" sound          │
│  └─ Customizable sound                 │
│                                         │
│  Method 2: 📱 Screen Flash             │
│  ├─ Order card blinks 3 times          │
│  └─ Attract attention                  │
│                                         │
│  Method 3: 📊 Pending Counter Update   │
│  ├─ Shows "Pending: +1"                │
│  └─ Number turns red                   │
│                                         │
│  Method 4: 💬 Quick Preview Popup      │
│  ├─ Shows order summary                │
│  └─ Auto-closes after 5 seconds        │
│                                         │
└─────────────────────────────────────────┘
```

### New Order Confirmation Steps

**Step 1: Quick Review Order Contents**

```
New Order Preview:
┌─────────────────────────┐
│ 🔔 New Order #025       │
├─────────────────────────┤
│ Table: Table 7          │
│ Time: 15:45             │
│                         │
│ Items:                  │
│ • Seafood Fried Rice x1│
│ • Hot & Sour Soup x2   │
│ • Salt & Pepper Squid  │
│                         │
│ ⚠️ Note: No chili       │
│                         │
│ [Got It] [Start Cooking]│
└─────────────────────────┘
```

**Step 2: Check Special Requirements**

```
Items Requiring Special Attention:
┌─────────────────────────────┐
│ 🔍 Checkpoints              │
├─────────────────────────────┤
│ ✓ Allergen Indicators       │
│   └─ No peanuts, no seafood│
│                             │
│ ✓ Customization Requests    │
│   └─ Medium rare, no onions│
│                             │
│ ✓ Special Notes             │
│   └─ Serve hot, separate   │
│                             │
│ ✓ Quantity Confirmation     │
│   └─ Multiple same items   │
└─────────────────────────────┘
```

**Step 3: Estimate Preparation Time**

```
Quick Time Estimation:
┌─────────────────────────────┐
│ Item        Est. Time       │
├─────────────────────────────┤
│ Fried Rice  8-10 minutes    │
│ Soups       5-7 minutes     │
│ Salads      3-5 minutes     │
│ Steaks      12-15 minutes   │
│ Roasts      15-20 minutes   │
│ Fried Items 8-12 minutes    │
└─────────────────────────────┘

Total Est: 15 minutes
Suggested Ready: 16:00
```

---

## 📊 Order Status Management

### Order Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ Complete Order Flow                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🆕 New Order                                           │
│   ↓                                                     │
│   ├─ Status: pending                                   │
│   ├─ Color: 🟦 Blue                                    │
│   └─ Action: Click "Start Cooking"                     │
│                                                         │
│   ↓                                                     │
│  🍳 Preparing                                           │
│   ↓                                                     │
│   ├─ Status: preparing                                 │
│   ├─ Color: 🟨 Yellow                                  │
│   ├─ Action: Currently cooking                         │
│   └─ Timer: Shows elapsed time                         │
│                                                         │
│   ↓                                                     │
│  ✅ Ready                                               │
│   ↓                                                     │
│   ├─ Status: ready                                     │
│   ├─ Color: 🟩 Green                                   │
│   ├─ Action: Waiting for service crew                  │
│   └─ Notification: Service crew notified               │
│                                                         │
│   ↓                                                     │
│  🚶 Delivered                                           │
│   ↓                                                     │
│   ├─ Status: delivered                                 │
│   ├─ Action: Service crew confirmed                    │
│   └─ Result: Removed from kitchen display              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Status Update Operations

**Update to "Preparing"**

When you're ready to start cooking:

```
┌─────────────────────────┐
│ #025 - Table 7          │
├─────────────────────────┤
│ • Seafood Rice x1      │
│ • Hot Sour Soup x2     │
│                         │
│ [✋ Start Cooking]      │  ← Click this button
└─────────────────────────┘

After Click ↓

┌─────────────────────────┐
│ #025 - Table 7  ⏱️ 3:25 │
├─────────────────────────┤
│ • Seafood Rice x1      │
│ • Hot Sour Soup x2     │
│                         │
│ [✓ Mark as Done]       │  ← Status updated
└─────────────────────────┘
```

**Update to "Ready"**

When dishes are completed:

```
Preparing → Ready

Steps:
1. Confirm all items completed
2. Check quality and appearance
3. Click "Mark as Done" button
4. Card moves to "Ready" column
5. System auto-notifies service crew
```

### Batch Operations Feature

**Process Multiple Orders at Once**

When multiple orders can be prepared together:

```
Batch Selection Mode:

☐ #023 - Fried Rice x2
☑ #024 - Fried Rice x1, Noodles x1
☑ #025 - Fried Rice x3

[Select Similar] [Start Cooking (2)]
                ↑
            2 orders selected

Benefits:
✓ Save preparation time
✓ Increase kitchen efficiency
✓ Faster simultaneous service
```

---

## 🔄 Multi-Order Processing

### Simultaneous Processing Strategy

```
┌─────────────────────────────────────────┐
│ Smart Order Processing Strategies       │
├─────────────────────────────────────────┤
│                                         │
│  Strategy 1: Group by Dish Type        │
│  ─────────────────────────             │
│  Rice dishes → Cook together           │
│  Soups → Prepare simultaneously        │
│  Grilled items → Same batch            │
│                                         │
│  Strategy 2: Sort by Cooking Time      │
│  ─────────────────────────             │
│  Long time → Start first               │
│  (Steaks)    (15 minutes)              │
│            ↓                            │
│  Medium time → Process next            │
│  (Fried Rice) (10 minutes)             │
│            ↓                            │
│  Short time → Prepare last             │
│  (Salads)    (5 minutes)               │
│                                         │
│  Strategy 3: Consolidate by Table      │
│  ─────────────────────────             │
│  Same table → Serve together           │
│  └─ Avoid staggered waiting            │
│                                         │
└─────────────────────────────────────────┘
```

### Peak Hour Management

```
Rush Hour Processing Flow:

┌─────────────────────────────────┐
│ 12:00-13:00 Lunch Rush          │
│ 18:00-20:00 Dinner Rush         │
├─────────────────────────────────┤
│                                 │
│  Phase 1: Prep (30 min before) │
│  ├─ Common ingredients ready   │
│  ├─ Condiments prepared        │
│  └─ Equipment preheated        │
│                                 │
│  Phase 2: Fast Service (Rush)  │
│  ├─ Priority to old orders     │
│  ├─ Batch similar items        │
│  └─ Maintain steady rhythm     │
│                                 │
│  Phase 3: Cleanup (After Rush) │
│  ├─ Complete remaining orders  │
│  ├─ Clean workstations         │
│  └─ Restock ingredients        │
│                                 │
└─────────────────────────────────┘
```

### Efficiency Enhancement Tips

```
┌─────────────────────────────────────┐
│ Kitchen Efficiency Golden Rules     │
├─────────────────────────────────────┤
│                                     │
│  1️⃣ Categorized Processing          │
│  └─ Group identical dishes         │
│                                     │
│  2️⃣ Parallel Cooking                │
│  └─ Use multiple stations          │
│                                     │
│  3️⃣ Pre-prepared Ingredients        │
│  └─ Common items ready ahead       │
│                                     │
│  4️⃣ Time Overlap                    │
│  └─ Process other orders while     │
│     waiting                         │
│                                     │
│  5️⃣ Clear Communication             │
│  └─ Explicit division of work      │
│                                     │
└─────────────────────────────────────┘
```

**Example: Processing 3 Orders Simultaneously**

```
Timeline: 15:00 → 15:15

15:00 → Start Steak (#020) - 15 min needed
15:05 → Start Fried Rice (#021) - 10 min
        ├─ Steak continues cooking
15:10 → Start Salad (#022) - 5 min
        ├─ Steak nearly done
        └─ Fried rice continues
15:15 → All 3 dishes ready ✓

Efficiency: 3 dishes in 15 minutes
           (30 minutes if sequential)
```

---

## ⚡ Priority Management

### Order Priority System

```
┌─────────────────────────────────────────┐
│ Priority Determination Criteria         │
├─────────────────────────────────────────┤
│                                         │
│  🔴 Highest Priority (Red Alert)       │
│  ├─ Waiting > 15 minutes               │
│  ├─ Customer inquired                  │
│  └─ Takeout near pickup time           │
│                                         │
│  🟠 High Priority (Orange)             │
│  ├─ Waiting 10-15 minutes              │
│  ├─ VIP customer orders                │
│  └─ Large table orders                 │
│                                         │
│  🟡 Medium Priority (Yellow)           │
│  ├─ Waiting 5-10 minutes               │
│  └─ Standard orders                    │
│                                         │
│  🟢 Low Priority (Green)               │
│  ├─ Just ordered (<5 minutes)          │
│  └─ Can process later                  │
│                                         │
└─────────────────────────────────────────┘
```

### Priority Visual Indicators

```
System Auto-marking:

┌─────────────────────────┐
│ #018 - Table 3  🔴 18:32│  ← Red Flashing (Overdue)
├─────────────────────────┤
│ ⚠️ Waiting 18 minutes!  │
│                         │
│ • Steak x2             │
│ • Salad x2             │
│                         │
│ [🚨 URGENT PROCESS]     │
└─────────────────────────┘

┌─────────────────────────┐
│ #019 - Table 5  🟠 12:25│  ← Orange Warning (Near Due)
├─────────────────────────┤
│ Waiting 12 minutes      │
│                         │
│ • Pasta x1             │
│ • Soup x2              │
│                         │
│ [Start Cooking]         │
└─────────────────────────┘

┌─────────────────────────┐
│ #020 - Table 8  🟢 3:45 │  ← Green (Normal)
├─────────────────────────┤
│ • Fried Rice x1        │
│ • Drink x1             │
│                         │
│ [Start Cooking]         │
└─────────────────────────┘
```

### Dynamic Adjustment Strategy

```
Situation Assessment Flow:

When new order arrives:
┌─────────────────────────────────┐
│                                 │
│  New Order → Assess Urgency     │
│           ↓                     │
│  Check ──→ Any overdue orders?  │
│           ↓ Yes    ↓ No         │
│  Priority Handle  Queue Normal  │
│           ↓                     │
│  Consider batch processing      │
│                                 │
└─────────────────────────────────┘
```

---

## 🚨 Special Situation Handling

### Ingredient Shortage Handling

```
┌─────────────────────────────────────────┐
│ Ingredient Shortage Response Flow       │
├─────────────────────────────────────────┤
│                                         │
│  Discover Shortage ──→ Immediate Action │
│                                         │
│  Step 1: Click "Report Issue" on card  │
│           ↓                             │
│  Step 2: Select "Ingredient Shortage"  │
│           ↓                             │
│  Step 3: Fill in missing items         │
│           ↓                             │
│  Step 4: System notifies owner/cashier │
│           ↓                             │
│  Step 5: Wait for instructions         │
│           ├─ Alternative item?         │
│           ├─ Cancel this item?         │
│           └─ Wait for restock?         │
│                                         │
└─────────────────────────────────────────┘
```

**Operation Example**:

```
┌─────────────────────────┐
│ #023 - Table 5          │
├─────────────────────────┤
│ • Steak x1 ❌ (Shortage)│
│ • Salad x1 ✓           │
│                         │
│ [⚠️ Report Issue]       │
└─────────────────────────┘

After Click ↓

┌─────────────────────────┐
│ Report Issue            │
├─────────────────────────┤
│ ⚪ Ingredient Shortage  │
│ ⚪ Equipment Failure    │
│ ⚪ Order Error          │
│ ⚪ Other Issues         │
│                         │
│ Missing Item: [Steak__] │
│                         │
│ [Submit Report]         │
└─────────────────────────┘
```

### Equipment Failure Handling

```
Common Equipment Issues:

┌─────────────────────────────────┐
│ Issue Type    Response          │
├─────────────────────────────────┤
│ Stove Failure → Use alternative │
│               └─ Notify owner   │
│                                 │
│ Oven Failure → Report can't    │
│               └─ Suggest alt.   │
│                                 │
│ Fridge Issue → Check temp      │
│               └─ Stop if needed │
│                                 │
│ Exhaust Fan → Pause frying     │
│               └─ Urgent repair  │
└─────────────────────────────────┘
```

### Order Error Handling

```
┌─────────────────────────────────────────┐
│ Order Issue Types & Handling            │
├─────────────────────────────────────────┤
│                                         │
│  Case 1: Customer Ordered Wrong        │
│  ──────────────────────────            │
│  If not yet started:                   │
│  ├─ Click "Modify Order"               │
│  ├─ Wait for customer/cashier confirm  │
│  └─ Prepare new content                │
│                                         │
│  If already cooking:                   │
│  ├─ Complete current preparation       │
│  └─ Cost decided by owner              │
│                                         │
│  Case 2: System Display Error          │
│  ──────────────────────────            │
│  ├─ Screenshot as evidence             │
│  ├─ Contact owner for confirmation     │
│  └─ Prepare based on actual situation  │
│                                         │
│  Case 3: Duplicate Order               │
│  ──────────────────────────            │
│  ├─ Verify order number                │
│  ├─ Check table/time                   │
│  └─ Notify cashier to confirm          │
│                                         │
└─────────────────────────────────────────┘
```

### Customer Complaint Assistance

```
When receiving complaint feedback:

┌─────────────────────────────────┐
│ Complaint Type  Kitchen Response│
├─────────────────────────────────┤
│ Too Salty   → Remake            │
│            └─ Adjust seasoning  │
│                                 │
│ Portion Small → Add more        │
│              └─ Check standard  │
│                                 │
│ Wrong Temp → Reheat/Cool        │
│            └─ Confirm serving   │
│                                 │
│ Poor Look → Replate             │
│           └─ Check standards    │
│                                 │
│ Foreign Object → Stop using     │
│                └─ Report owner  │
└─────────────────────────────────┘
```

---

## 👥 Team Collaboration

### Collaboration with Service Crew

```
┌─────────────────────────────────────────┐
│ Kitchen ←→ Service Crew Communication   │
├─────────────────────────────────────────┤
│                                         │
│  Kitchen Complete ──→ Mark "Ready"      │
│      ↓                                  │
│  System Notify ──→ Service crew sees   │
│      ↓                                  │
│  Crew Confirm ──→ Go to kitchen        │
│      ↓                                  │
│  Verify Order ──→ Check items & table  │
│      ↓                                  │
│  Deliver ──→ Mark "Delivered"           │
│      ↓                                  │
│  Order Complete ──→ Remove from system  │
│                                         │
└─────────────────────────────────────────┘
```

**Service Communication Example**:

```
Scenario: Dishes ready, waiting for crew

Kitchen Display:
┌─────────────────────────┐
│ #025 - Table 7  ✅ Ready│
├─────────────────────────┤
│ • Seafood Rice x1      │
│ • Hot Sour Soup x2     │
│                         │
│ ✓ Waiting for pickup    │
│                         │
│ Notified: Mike 📱       │
└─────────────────────────┘

Service Crew Tablet:
┌─────────────────────────┐
│ 🔔 New Ready Order      │
├─────────────────────────┤
│ #025 - Table 7          │
│ Chef: John              │
│                         │
│ [Pick Up] [Later]       │
└─────────────────────────┘
```

### Collaboration with Owner/Cashier

```
Situations requiring owner involvement:

┌─────────────────────────────────┐
│ Scenario          Notification  │
├─────────────────────────────────┤
│ Ingredient Out → Auto notify    │
│                └─ Need decision │
│                                 │
│ Equipment Fail → Urgent alert   │
│                └─ Need repair   │
│                                 │
│ Order Abnormal → Mark issue     │
│                └─ Need confirm  │
│                                 │
│ Complaint → Real-time comm      │
│            └─ Need instruction  │
│                                 │
│ Stock Advice → Daily report     │
│              └─ Restock ref     │
└─────────────────────────────────┘
```

### Multi-Chef Collaboration Mode

```
When kitchen has multiple chefs:

┌─────────────────────────────────────────┐
│ Division of Labor Modes                 │
├─────────────────────────────────────────┤
│                                         │
│  Mode 1: Station Division              │
│  ─────────────────                     │
│  Chef A → Stir-fry station             │
│  Chef B → Grill station                │
│  Chef C → Soups/Cold kitchen           │
│                                         │
│  System auto-assigns to stations       │
│                                         │
│  Mode 2: Open Queue                    │
│  ─────────────────                     │
│  All chefs see same orders             │
│  First to claim gets it                │
│                                         │
│  ⚠️ Avoid duplicates:                   │
│  └─ "Start" hides from others          │
│                                         │
│  Mode 3: Head Chef Coordination        │
│  ─────────────────────────             │
│  Head chef assigns orders              │
│  Assistants help prep                  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 💡 Efficiency Tips

### Time Management Tips

```
┌─────────────────────────────────────────┐
│ Kitchen Time Management Golden Rules    │
├─────────────────────────────────────────┤
│                                         │
│  Rule 1: Maximize Prep Time            │
│  ─────────────────────                 │
│  • Full prep during off-peak           │
│  • Common ingredients ready            │
│  • Seasonings pre-mixed                │
│                                         │
│  Rule 2: Utilize Waiting Time          │
│  ─────────────────────                 │
│  • Steak grilling → Prep salad         │
│  • Soup cooking → Cut vegetables       │
│  • Rice steaming → Process ingredients │
│                                         │
│  Rule 3: Optimize Cooking Order        │
│  ─────────────────────                 │
│  • Long-time dishes start first        │
│  • Short-time dishes last              │
│  • Same table ready together           │
│                                         │
│  Rule 4: Batch Processing Efficiency   │
│  ─────────────────────                 │
│  • 3 fried rice together               │
│  • 5 soups together                    │
│  • Save repetitive actions             │
│                                         │
└─────────────────────────────────────────┘
```

### Kitchen Flow Optimization

```
Ideal Kitchen Workflow:

┌─────────────────────────────────┐
│                                 │
│  Prep Area ──→ Cook ──→ Service │
│    ↑                      │     │
│    └──────────────────────┘     │
│         Cleanup/Recovery        │
│                                 │
└─────────────────────────────────┘

Flow Optimization Principles:
✓ Reduce back-and-forth movement
✓ Tools within reach
✓ Ingredients categorized
✓ Trash bins positioned well
✓ Cleaning supplies nearby
```

### System Feature Utilization

```
┌─────────────────────────────────────────┐
│ Hidden Useful Features                  │
├─────────────────────────────────────────┤
│                                         │
│  Feature 1: Order Search               │
│  ─────────────────                     │
│  Shortcut: Ctrl + F                    │
│  Use: Quick find table or dish         │
│                                         │
│  Feature 2: Order Filter               │
│  ─────────────────                     │
│  ☑ Show only fried rice                │
│  ☑ Show only soups                     │
│  → Easier batch processing             │
│                                         │
│  Feature 3: History View               │
│  ─────────────────                     │
│  Check today's completed orders        │
│  Verify no duplicates                  │
│                                         │
│  Feature 4: Statistics                 │
│  ─────────────────                     │
│  Today completed: 45 orders            │
│  Average time: 12 minutes              │
│  Most popular: Seafood Rice            │
│                                         │
│  Feature 5: Quick Notes                │
│  ─────────────────                     │
│  Add notes when completing order       │
│  "Extra spicy" "No cilantro-confirmed" │
│                                         │
└─────────────────────────────────────────┘
```

### Rush Hour Survival Guide

```
Peak Period Strategy:

┌─────────────────────────────────┐
│ Lunch/Dinner Rush               │
├─────────────────────────────────┤
│                                 │
│  30 min before:                 │
│  ├─ Extra prep                 │
│  ├─ Preheat equipment          │
│  ├─ Check inventory            │
│  └─ Mental preparation         │
│                                 │
│  During rush:                   │
│  ├─ Focus current order        │
│  ├─ Avoid panic                │
│  ├─ Maintain rhythm            │
│  └─ Team communication         │
│                                 │
│  After rush:                    │
│  ├─ Complete remaining         │
│  ├─ Clean environment          │
│  ├─ Restock ingredients        │
│  └─ Brief rest                 │
│                                 │
└─────────────────────────────────┘

Mental Preparation:
✓ Stay calm
✓ One at a time
✓ Never compromise quality
✓ Trust the team
```

---

## ❓ Frequently Asked Questions

### System Operation Related

**Q1: No sound notification for orders?**

```
A: Check Steps
┌─────────────────────────────┐
│ 1. Check device volume      │
│    └─ Tablet/PC volume on? │
│                             │
│ 2. Check system settings    │
│    └─ Settings → Sound → ON│
│                             │
│ 3. Test sound               │
│    └─ Click "Test Sound"   │
│                             │
│ 4. Reload page              │
│    └─ F5 or refresh        │
│                             │
│ 5. Clear browser cache      │
│    └─ Settings → Clear cache│
└─────────────────────────────┘
```

**Q2: Why can't I see some orders?**

```
A: Possible Reasons
┌─────────────────────────────┐
│ Reason 1: Filter enabled    │
│ └─ Solution: "Show All"    │
│                             │
│ Reason 2: Other chef claimed│
│ └─ Solution: Normal        │
│                             │
│ Reason 3: Order cancelled   │
│ └─ Solution: Check history │
│                             │
│ Reason 4: Station limits    │
│ └─ Solution: Contact owner │
└─────────────────────────────┘
```

**Q3: Clicked wrong button?**

```
A: Status Rollback Feature
┌─────────────────────────────┐
│ Within 30 seconds:          │
│                             │
│ 1. Click order card         │
│ 2. Click "⋯" more options   │
│ 3. Select "Rollback Status" │
│ 4. Confirm rollback         │
│                             │
│ After 30 seconds:           │
│ └─ Contact cashier/owner   │
└─────────────────────────────┘
```

### Order Processing Related

**Q4: Order details unclear?**

```
A: Magnify Display Feature
┌─────────────────────────────┐
│ Method 1: Click order card  │
│ └─ Opens detailed window   │
│                             │
│ Method 2: Adjust font size  │
│ └─ Settings → Display → Lg │
│                             │
│ Method 3: Voice reading     │
│ └─ System reads order      │
└─────────────────────────────┘
```

**Q5: Multiple orders for same dish?**

```
A: Batch Cooking Feature
┌─────────────────────────────┐
│ Steps:                      │
│ 1. Enable "Batch Mode"      │
│ 2. Check orders to merge    │
│ 3. Click "Start (3)"        │
│ 4. Mark each done when ready│
│                             │
│ Example:                    │
│ #020 Rice x2 ☑             │
│ #021 Rice x1 ☑             │
│ #023 Rice x3 ☑             │
│ ────────────────            │
│ Total: 6 rice together     │
└─────────────────────────────┘
```

**Q6: Too many orders?**

```
A: Overload Response Strategy
┌─────────────────────────────┐
│ 1. Activate emergency mode  │
│    └─ Auto notifies owner   │
│                             │
│ 2. Priority to overdue      │
│    └─ Process red first    │
│                             │
│ 3. Request backup           │
│    └─ Other chefs help     │
│                             │
│ 4. Pause new orders         │
│    └─ Owner stops online   │
│                             │
│ 5. Honest communication     │
│    └─ State actual wait    │
└─────────────────────────────┘
```

### Abnormal Situations

**Q7: Network disconnected?**

```
A: Offline Mode Handling
┌─────────────────────────────┐
│ Already downloaded orders:  │
│ ✓ Can continue viewing      │
│ ✓ Can continue cooking      │
│ ✗ Cannot update status      │
│                             │
│ Recommended:                │
│ 1. Record completed on paper│
│ 2. Manual sync when back   │
│ 3. Contact owner            │
│                             │
│ Emergency backup:           │
│ └─ Switch to manual mode   │
└─────────────────────────────┘
```

**Q8: Tablet/computer crashed?**

```
A: Equipment Failure Handling
┌─────────────────────────────┐
│ Immediate Actions:          │
│ 1. Use backup device        │
│    └─ Mobile phone OK      │
│                             │
│ 2. Contact owner/IT         │
│    └─ Technical support    │
│                             │
│ 3. Temporary method         │
│    └─ Verbal confirmation  │
│                             │
│ Prevention:                 │
│ • Regular device restart   │
│ • Keep software updated    │
│ • Backup device standby    │
└─────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Common Technical Issues

```
┌─────────────────────────────────────────┐
│ Problem Quick Reference                 │
├─────────────────────────────────────────┤
│                                         │
│  Problem: Blank screen                 │
│  ─────────                             │
│  ✓ Refresh page (F5)                   │
│  ✓ Clear cache and re-login            │
│  ✓ Check network connection            │
│                                         │
│  Problem: Orders not updating          │
│  ─────────                             │
│  ✓ Verify network status               │
│  ✓ Check connection indicator          │
│  ✓ Re-login to system                  │
│                                         │
│  Problem: Button unresponsive          │
│  ─────────                             │
│  ✓ Wait 3 seconds, try again           │
│  ✓ Reload page                         │
│  ✓ Use different browser               │
│                                         │
│  Problem: Display garbled              │
│  ─────────                             │
│  ✓ Adjust screen resolution            │
│  ✓ Zoom in/out (Ctrl +/-)             │
│  ✓ Restart browser                     │
│                                         │
└─────────────────────────────────────────┘
```

### Emergency Contact Methods

```
┌─────────────────────────────┐
│ Need Help:                  │
├─────────────────────────────┤
│                             │
│ First Line: Owner/Manager   │
│ └─ On-site immediate help  │
│                             │
│ Second Line: Tech Support   │
│ ├─ Phone: 0800-xxx-xxx     │
│ ├─ Email: support@xxx.com  │
│ └─ LINE: @makanmakan       │
│                             │
│ Emergency: System Admin     │
│ └─ 24/7 hotline            │
│                             │
└─────────────────────────────┘
```

### System Maintenance Windows

```
Regular Maintenance Schedule:

┌─────────────────────────────┐
│ Every Wed 2:00 - 4:00 AM    │
│ (Off-peak hours)            │
├─────────────────────────────┤
│                             │
│ Maintenance Tasks:          │
│ • System updates            │
│ • Database optimization     │
│ • Performance improvements  │
│                             │
│ Impact:                     │
│ • May briefly unable login  │
│ • Active orders unaffected  │
│                             │
│ Notifications:              │
│ • Day before reminder       │
│ • 1 hour before reminder    │
└─────────────────────────────┘
```

---

## 📊 Performance Tracking

### Personal Statistics

System automatically tracks your performance:

```
┌─────────────────────────────────────────┐
│ Chef Performance Dashboard              │
├─────────────────────────────────────────┤
│                                         │
│  Today's Stats: (2025-10-26)            │
│  ├─ Completed: 45 orders               │
│  ├─ Avg Time: 11 minutes               │
│  ├─ On-time Rate: 96%                  │
│  └─ Complaints: 0                      │
│                                         │
│  This Week:                             │
│  ├─ Total Orders: 276                  │
│  ├─ Fastest: 3 min (Salad)            │
│  ├─ Most Popular: Fried Rice (52)     │
│  └─ Customer Rating: 98%               │
│                                         │
│  Personal Ranking:                      │
│  ├─ Speed Rank: 2/5                    │
│  ├─ Quality Score: 4.8/5.0            │
│  └─ Team Contribution: 35%             │
│                                         │
└─────────────────────────────────────────┘
```

### Continuous Improvement

```
Performance Enhancement Areas:

┌─────────────────────────────┐
│ 1. Speed Optimization       │
│    ├─ Know menu well       │
│    ├─ Adequate prep        │
│    └─ Smooth movements     │
│                             │
│ 2. Quality Control          │
│    ├─ Standardize process  │
│    ├─ Pre-service check    │
│    └─ Continuous learning  │
│                             │
│ 3. Communication            │
│    ├─ Proactive reporting  │
│    ├─ Team cooperation     │
│    └─ Share experience     │
│                             │
│ 4. System Utilization       │
│    ├─ Use features well    │
│    ├─ Quick operations     │
│    └─ Data analysis        │
└─────────────────────────────┘
```

---

## 🎯 Chef Work Code

### Quality Standards

```
┌─────────────────────────────────────────┐
│ Service Quality Checklist               │
├─────────────────────────────────────────┤
│                                         │
│  ✓ Temperature Check                   │
│    ├─ Hot food hot enough (>65°C)      │
│    └─ Cold food cold enough (<5°C)     │
│                                         │
│  ✓ Portion Verification                │
│    ├─ Meets standard weight            │
│    └─ Correct side dish ratio          │
│                                         │
│  ✓ Appearance Inspection               │
│    ├─ Neat plating                     │
│    ├─ Vibrant colors                   │
│    └─ No stains                        │
│                                         │
│  ✓ Completeness Check                  │
│    ├─ All items present                │
│    ├─ Condiments complete              │
│    └─ Correct utensils                 │
│                                         │
└─────────────────────────────────────────┘
```

### Hygiene & Safety

```
┌─────────────────────────────┐
│ Food Safety Essentials      │
├─────────────────────────────┤
│ Personal Hygiene:           │
│ ✓ Wash hands before work   │
│ ✓ Wear uniform and hat     │
│ ✓ Short nails              │
│ ✓ No jewelry               │
│                             │
│ Environmental Hygiene:      │
│ ✓ Keep workstation clean   │
│ ✓ Categorize ingredients   │
│ ✓ Separate raw/cooked      │
│ ✓ Timely trash disposal    │
│                             │
│ Ingredient Handling:        │
│ ✓ Check expiration dates   │
│ ✓ Proper temp storage      │
│ ✓ Avoid cross-contamination│
│ ✓ Cook thoroughly          │
└─────────────────────────────┘
```

---

## 📱 System Quick Operations

### Keyboard Shortcuts

```
┌─────────────────────────────────────────┐
│ Efficiency Shortcuts                    │
├─────────────────────────────────────────┤
│                                         │
│ F5             Refresh page             │
│ Ctrl + F       Search orders            │
│ Ctrl + P       Print order (if needed)  │
│ Spacebar       Start/Done (when selected)│
│ Esc            Close popup              │
│ ↑ ↓ ← →       Navigate orders           │
│ Tab            Switch input fields      │
│                                         │
└─────────────────────────────────────────┘
```

### Touch Gestures (Touchscreen)

```
┌─────────────────────────────┐
│ Touch Gestures              │
├─────────────────────────────┤
│ Tap        Select order     │
│ Double tap Quick start      │
│ Long press Show more options│
│ Swipe left Mark done        │
│ Swipe right Rollback/cancel │
│ Pinch      Zoom view        │
└─────────────────────────────┘
```

---

## 🌟 Conclusion

Thank you for using the MakanMakan Kitchen Display System!

```
┌─────────────────────────────────────────┐
│                                         │
│  You are the heart of the restaurant    │
│  Every dish carries customer expectations│
│  The system is your assistant           │
│  Let's create wonderful dining experiences│
│                                         │
│            👨‍🍳 Good Luck!               │
│                                         │
└─────────────────────────────────────────┘
```

### Remember These Principles

✅ **Quality First** - Never compromise
✅ **Efficiency Matters** - But not at quality's expense
✅ **Teamwork** - Communication is key
✅ **Keep Learning** - Continuous improvement
✅ **Stay Passionate** - Love cooking

---

## 📞 Need Help?

**Technical Support**: support@makanmakan.com
**Customer Service**: 0800-123-456
**Online Docs**: docs.makanmakan.com
**Community Support**: Facebook / LINE Official

---

<div align="center">

**MakanMakan Chef Operations Manual**

Making kitchen management smarter, cooking more focused

**Version 2.0** | **2025-10-26**

Built with ❤️ for all chefs

</div>
