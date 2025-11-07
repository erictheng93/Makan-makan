# 👨‍🍳 MakanMakan Gabay sa Paggamit para sa Chef

> **Bersyon**: 2.0
> **Petsa ng Update**: 2025-10-26
> **Para sa**: Kawani sa Kusina, Chef, Head Chef

---

## 📚 Talaan ng Nilalaman

1. [Mabilis na Simula](#mabilis-na-simula)
2. [Pangkalahatang-tanaw ng Sistema](#pangkalahatang-tanaw-ng-sistema)
3. [Interface ng Kitchen Display System](#interface-ng-kitchen-display-system)
4. [Pag-login at Pangunahing Operasyon](#pag-login-at-pangunahing-operasyon)
5. [Proseso ng Pagtanggap ng Order](#proseso-ng-pagtanggap-ng-order)
6. [Pamamahala ng Status ng Order](#pamamahala-ng-status-ng-order)
7. [Pagproseso ng Maraming Order](#pagproseso-ng-maraming-order)
8. [Pamamahala ng Prioridad](#pamamahala-ng-prioridad)
9. [Paghawak ng Espesyal na Sitwasyon](#paghawak-ng-espesyal-na-sitwasyon)
10. [Pakikipagtulungan sa Koponan](#pakikipagtulungan-sa-koponan)
11. [Mga Tips sa Pagpapabuti ng Kahusayan](#mga-tips-sa-pagpapabuti-ng-kahusayan)
12. [Mga Madalas Itanong](#mga-madalas-itanong)
13. [Troubleshooting](#troubleshooting)

---

## 🚀 Mabilis na Simula

### Mga Pangunahing Responsibilidad ng Chef

```
┌─────────────────────────────────────────────┐
│ Daloy ng Trabaho ng Chef                   │
├─────────────────────────────────────────────┤
│                                             │
│  1️⃣ Tumanggap ng bagong order              │
│      ↓                                      │
│  2️⃣ Kumpirmahin ang nilalaman ng order     │
│      ↓                                      │
│  3️⃣ I-update sa "Preparing"                │
│      ↓                                      │
│  4️⃣ Magsimulang magluto                    │
│      ↓                                      │
│  5️⃣ Pagkatapos kumpletuhin, i-update sa    │
│     "Completed"                             │
│      ↓                                      │
│  6️⃣ Ipaalam sa food runner na kunin ang    │
│     pagkain                                 │
│                                             │
└─────────────────────────────────────────────┘
```

### Checklist para sa Unang Paggamit

✅ **Unang Hakbang: Kumpirmahin ang Account at Device**
- Kumpirmahin na nakakuha ng chef account
- Subukan ang pag-login sa kitchen display system
- Kumpirmahin na normal ang display screen

✅ **Ikalawang Hakbang: Maging Pamilyar sa Interface**
- Intindihin ang layout ng order card
- Magsanay sa pag-update ng status
- Subukan ang sound notification

✅ **Ikatlong Hakbang: Intindihin ang Proseso**
- Paraan ng notification ng bagong order
- Mga hakbang sa pag-update ng status
- Proseso ng pagkumpleto ng order

✅ **Ikaapat na Hakbang: Paghahanda sa Trabaho**
- Kumpirmahin na handa ang kagamitan sa kusina
- Suriin ang prep ng mga sangkap
- Magsimulang tumanggap ng mga order

---

## 🏢 Pangkalahatang-tanaw ng Sistema

### Posisyon ng Kitchen Display System

```
┌─────────────────────────────────────────────────────────┐
│ MakanMakan Kitchen Ecosystem                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Customer Order ───→ Order System ───→ Kitchen Display ───→ Delivery Confirmation   │
│                          ↓               ↓               ↓         │
│                     Shop Owner      【IKAW NANDITO】  Customer     │
│                     Monitoring                        Tracking     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Mode ng Kolaborasyon ng Papel sa Kusina

```
        Pinagmulan ng Order
           │
    ┌──────┴──────┐
    ↓             ↓
  Table Order  Shop Order
    │             │
    └──────┬──────┘
           ↓
    【Kitchen Display System】
     (Iyong Workstation)
           │
    ┌──────┴──────┐
    ↓             ↓
  Food Runner  Customer Side
  Kumpirmasyon Real-time
  ng Delivery  Tracking
```

**Paliwanag**:
- **Customer**: Mag-order gamit ang QR Code
- **Kitchen System**: Real-time na tumanggap at ipakita ang mga order
- **Chef (Ikaw)**: Iproseso ang order at i-update ang status
- **Food Runner**: Kunin at ihatid sa customer
- **Shop Owner**: Subaybayan ang pangkalahatang operasyon

---

## 🖥️ Interface ng Kitchen Display System

### Layout ng Main Screen

```
┌───────────────────────────────────────────────────────────┐
│  🏪 Pangalan ng Restaurant  👨‍🍳 Chef: Wang  🕐 14:35   │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  【Pending】       【Preparing】      【Completed】        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ #001     │    │ #002     │    │ #003     │          │
│  │ Mesa: 5  │    │ Mesa: 3  │    │ Mesa: 8  │          │
│  │ Oras:    │    │ Oras:    │    │ Oras:    │          │
│  │ 14:30    │    │ 14:25    │    │ 14:20    │          │
│  │          │    │          │    │          │          │
│  │ Items:   │    │ Items:   │    │ Items:   │          │
│  │ • Steak  │    │ • Pasta  │    │ • Salad  │          │
│  │ • Salad  │    │ • Soup   │    │ • Soup   │          │
│  │          │    │          │    │          │          │
│  │ [Start]  │    │ [Done]   │    │ ✓ Done   │          │
│  └──────────┘    └──────────┘    └──────────┘          │
│                                                           │
│  ┌──────────┐                                            │
│  │ #004     │                                            │
│  │ Mesa: 12 │                                            │
│  │ Oras:    │                                            │
│  │ 14:32 🔔 │    (New order alert sound)                 │
│  │          │                                            │
│  │ Items:   │                                            │
│  │ • Curry  │                                            │
│  │ • Drink  │                                            │
│  │          │                                            │
│  │ [Start]  │                                            │
│  └──────────┘                                            │
│                                                           │
├───────────────────────────────────────────────────────────┤
│  📊 Stats Ngayon: Tapos na 23 | In Progress 5 | Pending 2 │
└───────────────────────────────────────────────────────────┘
```

### Detalyadong Paliwanag ng Order Card

```
┌─────────────────────────────┐
│ Istraktura ng Order Card    │
├─────────────────────────────┤
│                             │
│  🔢 Order Number: #001      │
│  ├─ Mabilis na pag-identify │
│  └─ Sync sa customer side   │
│                             │
│  🪑 Table/Seat: Mesa 5      │
│  ├─ Malinaw na lokasyon     │
│  └─ Iwasan ang maling hatid │
│                             │
│  ⏰ Order Time: 14:30       │
│  ├─ Malaman ang waiting time│
│  └─ Reference sa priority   │
│                             │
│  📋 Order Items:            │
│  ├─ Steak x1 (Medium)       │
│  ├─ Caesar Salad x1         │
│  └─ Corn Soup x2            │
│                             │
│  💬 Notes: Walang sibuyas   │
│  └─ Paalala ng special needs│
│                             │
│  🎯 Status Button: [Start]  │
│  └─ One-click status update │
│                             │
└─────────────────────────────┘
```

### Sistema ng Pagmamarka ng Kulay

```
┌─────────────────────────────────────────┐
│ Sistema ng Visual Cue                   │
├─────────────────────────────────────────┤
│                                         │
│  🟦 Asul = Bagong Order (Pending)       │
│  └─ Hindi pa nagsisimula                │
│                                         │
│  🟨 Dilaw = Preparing                   │
│  └─ Kasalukuyang nagluluto             │
│                                         │
│  🟩 Berde = Completed                   │
│  └─ Pwede nang ihain                    │
│                                         │
│  🟥 Pula = Naghintay ng higit 15 min    │
│  └─ Kailangan ng priority handling      │
│                                         │
│  🔔 Kumikinang = Bagong Order           │
│  └─ May kasama pang sound alert         │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔐 Pag-login at Pangunahing Operasyon

### Proseso ng Pag-login

**Hakbang 1: Buksan ang Kitchen Display System**

Pumunta sa: URL ng sistema sa kitchen tablet o display

```
Halimbawa ng URL:
https://kitchen.makanmakan.com
o
https://your-restaurant.makanmakan.com/kitchen
```

**Hakbang 2: Ilagay ang Chef Account**

```
┌─────────────────────────────┐
│  👨‍🍳 Kitchen System Login   │
├─────────────────────────────┤
│                             │
│  Account: [chef001______]   │
│  Password: [************]   │
│                             │
│  ☐ Remember Me (workstation │
│     use only)               │
│                             │
│  [     Login System    ]    │
│                             │
└─────────────────────────────┘
```

**Hakbang 3: Pumili ng Workstation (Kung Naaangkop)**

Ang ilang restaurant ay may maraming kitchen workstation (hal.: Cold Station, Wok Station, Grill Station)

```
Pumili ng Iyong Workstation:
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Cold     │  │ Wok      │  │ Grill    │
│ Station  │  │ Station  │  │ Station  │
│          │  │          │  │          │
│ Display: │  │ Display: │  │ Display: │
│ Salads,  │  │ Fried    │  │ Steaks,  │
│ Apps     │  │ Rice/Nood│  │ Grilled  │
│          │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘
```

### Mga Susuriin Pagkatapos ng Login

✅ **Kumpirmasyon ng Status ng Sistema**
```
┌─────────────────────────────┐
│ System Checklist            │
├─────────────────────────────┤
│ ✓ Normal ang network        │
│ ✓ Gumagana ang real-time    │
│   update                    │
│ ✓ Naka-on ang sound alert   │
│ ✓ Tamang brightness ng      │
│   display                   │
│ ✓ Naka-load ang menu ngayon │
└─────────────────────────────┘
```

### Pag-adjust ng Basic Settings

**Sound Settings**

I-click ang ⚙️ settings icon sa upper right:

```
🔊 New Order Alert Sound:
├─ 🔔 Standard Bell
├─ 📢 Loud Alert
├─ 🎵 Soft Music
└─ 🔇 Silent Mode

Volume: ▓▓▓▓▓▓▓▓░░ (80%)
```

**Display Settings**

```
📺 Display Mode:
├─ 📱 Compact Mode (small screen)
├─ 🖥️  Standard Mode (medium screen)
└─ 📺 Kitchen Mode (large screen)

Font Size:
├─ Standard (Recommended)
├─ Large (for presbyopia)
└─ Extra Large (for distance viewing)
```

---

## 📥 Proseso ng Pagtanggap ng Order

### Mekanismo ng Notification ng Bagong Order

```
┌─────────────────────────────────────────┐
│ Paraan ng Notification ng Bagong Order │
├─────────────────────────────────────────┤
│                                         │
│  Method 1: 🔔 Sound Alert               │
│  ├─ Default "ding-dong" sound           │
│  └─ Pwedeng i-customize                 │
│                                         │
│  Method 2: 📱 Screen Flash              │
│  ├─ Order card flashes 3 times          │
│  └─ Upang makuha ang atensyon           │
│                                         │
│  Method 3: 📊 Pending Counter Update    │
│  ├─ Nagpapakita ng "Pending: +1"        │
│  └─ Number turns red                    │
│                                         │
│  Method 4: 💬 Pop-up Quick Preview      │
│  ├─ Ipakita ang order summary           │
│  └─ Auto-close after 5 seconds          │
│                                         │
└─────────────────────────────────────────┘
```

### Mga Hakbang sa Pagkumpirma ng Bagong Order

**Hakbang 1: Mabilis na Tingnan ang Nilalaman ng Order**

```
New Order Preview:
┌─────────────────────────┐
│ 🔔 Bagong Order #025    │
├─────────────────────────┤
│ Mesa: Mesa 7            │
│ Oras: 15:45             │
│                         │
│ Items:                  │
│ • Seafood Fried Rice x1 │
│ • Hot & Sour Soup x2    │
│ • Salt & Pepper Squid x1│
│                         │
│ ⚠️ Notes: Walang sili   │
│                         │
│ [Got It] [Start Cooking]│
└─────────────────────────┘
```

**Hakbang 2: Suriin ang Mga Espesyal na Kahilingan**

```
Mga Item na Kailangan ng Espesyal na Atensyon:
┌─────────────────────────────┐
│ 🔍 Mga Checkpoint           │
├─────────────────────────────┤
│ ✓ Allergen Markers          │
│   └─ No peanuts, no seafood │
│                             │
│ ✓ Customization Requests    │
│   └─ Medium rare, no onions │
│                             │
│ ✓ Special Notes             │
│   └─ Serve hot, separate    │
│                             │
│ ✓ Quantity Confirmation     │
│   └─ Multiple of same item  │
└─────────────────────────────┘
```

**Hakbang 3: Tantiyahin ang Oras ng Pagluluto**

```
Mabilis na Pagtantya ng Oras:
┌─────────────────────────────┐
│ Item        Estimated Time  │
├─────────────────────────────┤
│ Fried Rice  8-10 min        │
│ Soup        5-7 min         │
│ Salad       3-5 min         │
│ Steak       12-15 min       │
│ Grilled     15-20 min       │
│ Fried       8-12 min        │
└─────────────────────────────┘

Total Estimated: 15 min
Suggested Serve: 16:00
```

---

## 📊 Pamamahala ng Status ng Order

### Order Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ Kumpletong Proseso ng Order                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🆕 Bagong Order                                        │
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
│   ├─ Action: Cooking in progress                       │
│   └─ Timer: Show elapsed time                          │
│                                                         │
│   ↓                                                     │
│  ✅ Completed                                           │
│   ↓                                                     │
│   ├─ Status: ready                                     │
│   ├─ Color: 🟩 Green                                   │
│   ├─ Action: Waiting for runner                        │
│   └─ Notification: Food runner notified                │
│                                                         │
│   ↓                                                     │
│  🚶 Delivered                                           │
│   ↓                                                     │
│   ├─ Status: delivered                                 │
│   ├─ Action: Runner confirmation                       │
│   └─ Result: Removed from kitchen display              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Mga Operasyon ng Status Update

**I-update sa "Preparing"**

Kapag handa ka nang magsimulang magluto:

```
┌─────────────────────────┐
│ #025 - Mesa 7           │
├─────────────────────────┤
│ • Seafood Fried Rice x1 │
│ • Hot & Sour Soup x2    │
│                         │
│ [✋ Start Cooking]       │  ← I-click ang button na ito
└─────────────────────────┘

After clicking ↓

┌─────────────────────────┐
│ #025 - Mesa 7  ⏱️ 3:25  │
├─────────────────────────┤
│ • Seafood Fried Rice x1 │
│ • Hot & Sour Soup x2    │
│                         │
│ [✓ Mark Complete]       │  ← Status updated
└─────────────────────────┘
```

**I-update sa "Completed"**

Kapag tapos na ang pagluluto:

```
Preparing → Completed

Mga Hakbang ng Operasyon:
1. Kumpirmahin na tapos na lahat ng items
2. Suriin ang quality at presentation
3. I-click ang "Mark Complete" button
4. Card moves to "Completed" column
5. System automatically notifies food runner
```

### Batch Operations Function

**Mag-process ng Maraming Order Nang Sabay**

Kapag pwedeng sabay-sabay lutuin ang maraming order:

```
Batch Selection Mode:

☐ #023 - Fried Rice x2
☑ #024 - Fried Rice x1, Noodles x1
☑ #025 - Fried Rice x3

[Select All Similar] [Start Cooking (2)]
                      ↑
                  2 orders selected

Mga Benepisyo:
✓ Makatipid ng oras sa pagluluto
✓ Mas mataas ang efficiency ng kusina
✓ Mas mabilis ang sabay-sabay na paghahain
```

---

## 🔄 Pagproseso ng Maraming Order

### Estratehiya sa Sabay-sabay na Pagproseso

```
┌─────────────────────────────────────────┐
│ Matalinong Estratehiya sa Order        │
├─────────────────────────────────────────┤
│                                         │
│  Strategy 1: Group by Dish Type         │
│  ─────────────────────────             │
│  Fried Rice → Cook together             │
│  Soups → Boil together                  │
│  Grilled → Grill in same batch          │
│                                         │
│  Strategy 2: Sort by Cooking Time       │
│  ─────────────────────────             │
│  Long Time → Start first                │
│  (Steak)      (15 min)                  │
│               ↓                         │
│  Medium Time → Process next             │
│  (Fried Rice) (10 min)                  │
│               ↓                         │
│  Short Time → Cook last                 │
│  (Salad)      (5 min)                   │
│                                         │
│  Strategy 3: Group by Table             │
│  ─────────────────────────             │
│  Same Table → Serve together            │
│  └─ Avoid customers waiting separately  │
│                                         │
└─────────────────────────────────────────┘
```

### Pamamahala ng Peak Hours

```
Proseso ng Peak Period Handling:

┌─────────────────────────────────┐
│ 12:00-13:00 Lunch Peak          │
│ 18:00-20:00 Dinner Peak         │
├─────────────────────────────────┤
│                                 │
│  Stage 1: Prep (30 min before)  │
│  ├─ Ready common ingredients    │
│  ├─ Prepare seasonings          │
│  └─ Preheat equipment           │
│                                 │
│  Stage 2: Fast Processing       │
│  ├─ Prioritize old orders       │
│  ├─ Batch similar items         │
│  └─ Maintain steady rhythm      │
│                                 │
│  Stage 3: Wrap-up (after peak)  │
│  ├─ Complete remaining orders   │
│  ├─ Clean workstation           │
│  └─ Restock ingredients         │
│                                 │
└─────────────────────────────────┘
```

### Mga Tips sa Pagpapabuti ng Kahusayan

```
┌─────────────────────────────────────┐
│ Gintong Tuntunin ng Kitchen         │
│ Efficiency                          │
├─────────────────────────────────────┤
│                                     │
│  1️⃣ Categorize Processing           │
│  └─ Concentrate same dishes         │
│                                     │
│  2️⃣ Parallel Cooking                │
│  └─ Use multiple burners at once    │
│                                     │
│  3️⃣ Advance Prep                    │
│  └─ Pre-prepare common ingredients  │
│                                     │
│  4️⃣ Overlap Time                    │
│  └─ Use waiting time for other tasks│
│                                     │
│  5️⃣ Clear Communication             │
│  └─ Clear division of labor         │
│                                     │
└─────────────────────────────────────┘
```

**Halimbawa: Sabay na Pagproseso ng 3 Order**

```
Timeline: 15:00 → 15:15

15:00 → Start steak (#020) - needs 15 min
15:05 → Start fried rice (#021) - needs 10 min
        ├─ Steak continues cooking
15:10 → Start salad (#022) - needs 5 min
        ├─ Steak almost done
        └─ Fried rice continues cooking
15:15 → All 3 dishes complete ✓

Efficiency: 15 min for 3 dishes
           (would take 30 min separately)
```

---

## ⚡ Pamamahala ng Prioridad

### Sistema ng Priority ng Order

```
┌─────────────────────────────────────────┐
│ Pamantayan ng Priority                  │
├─────────────────────────────────────────┤
│                                         │
│  🔴 Highest Priority (Red Alert)        │
│  ├─ Waiting over 15 min                 │
│  ├─ Customer requesting                 │
│  └─ Takeout near pickup time            │
│                                         │
│  🟠 High Priority (Orange Reminder)     │
│  ├─ Waiting 10-15 min                   │
│  ├─ VIP customer order                  │
│  └─ Large table order                   │
│                                         │
│  🟡 Medium Priority (Yellow Standard)   │
│  ├─ Waiting 5-10 min                    │
│  └─ Regular order                       │
│                                         │
│  🟢 Low Priority (Green)                │
│  ├─ Just ordered (<5 min)               │
│  └─ Can process later                   │
│                                         │
└─────────────────────────────────────────┘
```

### Visual ng Priority

```
Automatic system marking:

┌─────────────────────────┐
│ #018 - Mesa 3  🔴 18:32 │  ← Red flashing (overtime)
├─────────────────────────┤
│ ⚠️ Waited 18 min!       │
│                         │
│ • Steak x2              │
│ • Salad x2              │
│                         │
│ [🚨 Process Now]        │
└─────────────────────────┘

┌─────────────────────────┐
│ #019 - Mesa 5  🟠 12:25 │  ← Orange alert (near overtime)
├─────────────────────────┤
│ Waited 12 min           │
│                         │
│ • Pasta x1              │
│ • Soup x2               │
│                         │
│ [Start Cooking]         │
└─────────────────────────┘

┌─────────────────────────┐
│ #020 - Mesa 8  🟢 3:45  │  ← Green standard (normal)
├─────────────────────────┤
│ • Fried Rice x1         │
│ • Drink x1              │
│                         │
│ [Start Cooking]         │
└─────────────────────────┘
```

### Estratehiya sa Dynamic Adjustment

```
Daloy ng Pagpapasya sa Sitwasyon:

Kapag may bagong order:
┌─────────────────────────────────┐
│                                 │
│  New Order → Evaluate urgency   │
│              ↓                  │
│  Check ──→ Any overtime orders? │
│            ↓ Yes   ↓ No         │
│  Priority to  Normal queue      │
│  overtime                       │
│            ↓                    │
│  Also consider batch processing │
│                                 │
└─────────────────────────────────┘
```

---

## 🚨 Paghawak ng Espesyal na Sitwasyon

### Paghawak ng Kulang na Sangkap

```
┌─────────────────────────────────────────┐
│ Proseso para sa Out of Stock            │
├─────────────────────────────────────────┤
│                                         │
│  Discover Out of Stock ──→ Immediate    │
│                            Action       │
│                                         │
│  Step 1: Click "Report Issue" on order  │
│          card                           │
│          ↓                              │
│  Step 2: Select "Out of Stock"          │
│          ↓                              │
│  Step 3: Fill in missing item           │
│          ↓                              │
│  Step 4: System notifies owner/cashier  │
│          ↓                              │
│  Step 5: Wait for instructions          │
│          ├─ Alternative option?         │
│          ├─ Cancel item?                │
│          └─ Wait for restock?           │
│                                         │
└─────────────────────────────────────────┘
```

**Demonstrasyon ng Operasyon**:

```
┌─────────────────────────┐
│ #023 - Mesa 5           │
├─────────────────────────┤
│ • Steak x1 ❌ (out)     │
│ • Salad x1 ✓            │
│                         │
│ [⚠️ Report Issue]       │
└─────────────────────────┘

After clicking ↓

┌─────────────────────────┐
│ Issue Report            │
├─────────────────────────┤
│ ⚪ Out of Stock         │
│ ⚪ Equipment Failure    │
│ ⚪ Order Error          │
│ ⚪ Other Issue          │
│                         │
│ Out of stock: [Steak__] │
│                         │
│ [Submit Report]         │
└─────────────────────────┘
```

### Paghawak ng Equipment Failure

```
Common Equipment Issues:

┌─────────────────────────────────┐
│ Issue Type    Handling Method   │
├─────────────────────────────────┤
│ Stove failure → Use other stove │
│               └─ Notify owner   │
│                  for repair     │
│                                 │
│ Oven failure → Report unable to │
│                make baked items │
│               └─ Suggest        │
│                  alternatives   │
│                                 │
│ Fridge issue → Check ingredient │
│                temperature      │
│               └─ Stop use if    │
│                  necessary      │
│                                 │
│ Exhaust fan → Pause deep frying │
│               └─ Immediate      │
│                  repair         │
└─────────────────────────────────┘
```

### Paghawak ng Order Error

```
┌─────────────────────────────────────────┐
│ Mga Uri ng Order Problem at Handling    │
├─────────────────────────────────────────┤
│                                         │
│  Case 1: Customer Wrong Order           │
│  ──────────────────                    │
│  If not yet started cooking:            │
│  ├─ Click "Modify Order"                │
│  ├─ Wait for customer/cashier confirm   │
│  └─ Cook according to new content       │
│                                         │
│  If already cooking:                    │
│  ├─ Complete current cooking            │
│  └─ Cost decided by shop                │
│                                         │
│  Case 2: System Display Error           │
│  ──────────────────                    │
│  ├─ Screenshot for evidence             │
│  ├─ Contact owner for confirmation      │
│  └─ Cook according to actual situation  │
│                                         │
│  Case 3: Duplicate Order                │
│  ──────────────────                    │
│  ├─ Confirm order number                │
│  ├─ Check table/time                    │
│  └─ Notify cashier for confirmation     │
│                                         │
└─────────────────────────────────────────┘
```

### Tulong sa Customer Complaint Handling

```
Kapag may customer complaint:

┌─────────────────────────────────┐
│ Complaint Type  Kitchen Response│
├─────────────────────────────────┤
│ Too salty    → Remake dish      │
│              └─ Check seasoning │
│                 ratio           │
│                                 │
│ Insufficient → Add more         │
│ portion      └─ Check weighing  │
│                 standard        │
│                                 │
│ Wrong temp   → Reheat/cool      │
│              └─ Verify serving  │
│                 temperature     │
│                                 │
│ Poor appear. → Re-plate         │
│              └─ Check quality   │
│                 standard        │
│                                 │
│ Foreign obj. → Stop using that  │
│                ingredient       │
│              └─ Report to owner │
└─────────────────────────────────┘
```

---

## 👥 Pakikipagtulungan sa Koponan

### Pakikipagtulungan sa Food Runner

```
┌─────────────────────────────────────────┐
│ Kitchen ←→ Food Runner Communication    │
├─────────────────────────────────────────┤
│                                         │
│  Kitchen Complete ──→ Mark "Completed"  │
│      ↓                                  │
│  System Notify ──→ Runner sees alert    │
│      ↓                                  │
│  Runner Confirm ──→ Go to kitchen       │
│      ↓                                  │
│  Verify Order ──→ Check items & table   │
│      ↓                                  │
│  Deliver ──→ Mark "Delivered"           │
│      ↓                                  │
│  Order Complete ──→ Remove from system  │
│                                         │
└─────────────────────────────────────────┘
```

**Halimbawa ng Food Service Communication**:

```
Scenario: Tapos na ang pagkain, naghihintay ng runner

Kitchen Display:
┌─────────────────────────┐
│ #025 - Mesa 7  ✅ Done  │
├─────────────────────────┤
│ • Seafood Fried Rice x1 │
│ • Hot & Sour Soup x2    │
│                         │
│ ✓ Waiting for runner    │
│                         │
│ Notified: Ming 📱       │
└─────────────────────────┘

Runner Tablet:
┌─────────────────────────┐
│ 🔔 New Food Ready       │
├─────────────────────────┤
│ #025 - Mesa 7           │
│ Chef: Wang              │
│                         │
│ [Pick Up] [Later]       │
└─────────────────────────┘
```

### Pakikipagtulungan sa Shop Owner/Cashier

```
Mga sitwasyon na kailangan ng owner intervention:

┌─────────────────────────────────┐
│ Situation     Notification Method│
├─────────────────────────────────┤
│ Out of stock → Auto system notify│
│              └─ Needs decision  │
│                                 │
│ Equipment    → Emergency alert  │
│ failure      └─ Needs repair    │
│                                 │
│ Order issue  → Flag problem     │
│              └─ Needs confirm   │
│                                 │
│ Complaint    → Immediate        │
│ handling     └─ Needs           │
│                 instruction     │
│                                 │
│ Prep suggest → Daily report     │
│              └─ Restock         │
│                 reference       │
└─────────────────────────────────┘
```

### Multi-Chef Collaboration Mode

```
Kapag may maraming chef sa kusina:

┌─────────────────────────────────────────┐
│ Collaboration Division Mode             │
├─────────────────────────────────────────┤
│                                         │
│  Mode 1: Workstation Division           │
│  ─────────────────                     │
│  Chef A → Wok station                   │
│  Chef B → Grill station                 │
│  Chef C → Soup/Cold station             │
│                                         │
│  System auto-assigns orders to          │
│  corresponding stations                 │
│                                         │
│  Mode 2: All-Purpose Orders             │
│  ─────────────────                     │
│  All chefs see same orders              │
│  First click first get                  │
│                                         │
│  ⚠️ Avoid duplicate cooking:            │
│  └─ After clicking "Start", others      │
│     can't see it                        │
│                                         │
│  Mode 3: Head Chef Dispatch             │
│  ─────────────────                     │
│  Head chef assigns orders to each chef  │
│  Assistants help with prep              │
│                                         │
└─────────────────────────────────────────┘
```

---

## 💡 Mga Tips sa Pagpapabuti ng Kahusayan

### Mga Tips sa Time Management

```
┌─────────────────────────────────────────┐
│ Gintong Tuntunin ng Kitchen Time        │
│ Management                              │
├─────────────────────────────────────────┤
│                                         │
│  Rule 1: Maximize Prep Time             │
│  ─────────────────────                 │
│  • Fully prep during off-peak           │
│  • Always refill common ingredients     │
│  • Pre-mix seasonings                   │
│                                         │
│  Rule 2: Utilize Waiting Time           │
│  ─────────────────────                 │
│  • Steak grilling → Prep salad          │
│  • Soup boiling → Cut vegetables        │
│  • Rice steaming → Handle other items   │
│                                         │
│  Rule 3: Optimize Cooking Order         │
│  ─────────────────────                 │
│  • Long-time dishes start first         │
│  • Short-time dishes cook last          │
│  • Ensure same table finishes together  │
│                                         │
│  Rule 4: Batch Processing Efficiency    │
│  ─────────────────────                 │
│  • 3 fried rice cook together           │
│  • 5 soups boil together                │
│  • Save repetitive motion time          │
│                                         │
└─────────────────────────────────────────┘
```

### Pag-optimize ng Kitchen Workflow

```
Ideal na Kitchen Workflow:

┌─────────────────────────────────┐
│                                 │
│  Prep Area ──→ Cook Area ──→    │
│  Serve Area                     │
│    ↑                       │    │
│    └───────────────────────┘    │
│      Cleaning/Recovery Area     │
│                                 │
└─────────────────────────────────┘

Prinsipyo ng Workflow Optimization:
✓ Bawasan ang pabalik-balik
✓ Madaling maabot ang tools
✓ Kategorya ng pagsasaayos ng sangkap
✓ Wastong posisyon ng basurahan
✓ Malapit na paghahanda ng cleaning supplies
```

### Paggamit ng Sistema Functions

```
┌─────────────────────────────────────────┐
│ Mga Nakatagong Kapaki-pakinabang na     │
│ Functions                               │
├─────────────────────────────────────────┤
│                                         │
│  Function 1: Order Search               │
│  ─────────────────                     │
│  Shortcut: Ctrl + F                     │
│  Use: Quickly find specific table/dish  │
│                                         │
│  Function 2: Order Filter               │
│  ─────────────────                     │
│  ☑ Show only fried rice                │
│  ☑ Show only soups                     │
│  → Easier batch processing              │
│                                         │
│  Function 3: History Records            │
│  ─────────────────                     │
│  View today's completed orders          │
│  Check for duplicates                   │
│                                         │
│  Function 4: Statistics Data            │
│  ─────────────────                     │
│  Today completed: 45 orders             │
│  Average time: 12 min                   │
│  Most popular: Seafood Fried Rice       │
│                                         │
│  Function 5: Quick Notes                │
│  ─────────────────                     │
│  Add notes when completing order        │
│  "Added spicy" "No cilantro-confirmed"  │
│                                         │
└─────────────────────────────────────────┘
```

### Gabay sa Pagsurvive sa Peak Period

```
Peak Hour Strategy:

┌─────────────────────────────────┐
│ Lunch/Dinner Peak Period        │
├─────────────────────────────────┤
│                                 │
│  30 min before:                 │
│  ├─ Strengthen prep             │
│  ├─ Preheat equipment           │
│  ├─ Confirm inventory           │
│  └─ Adjust mindset              │
│                                 │
│  During peak:                   │
│  ├─ Focus on current orders     │
│  ├─ Avoid panic                 │
│  ├─ Maintain rhythm             │
│  └─ Team communication          │
│                                 │
│  After peak:                    │
│  ├─ Complete remaining orders   │
│  ├─ Clean environment           │
│  ├─ Refill prep                 │
│  └─ Short break                 │
│                                 │
└─────────────────────────────────┘

Mental Preparation:
✓ Stay calm
✓ One by one
✓ Quality cannot be sacrificed
✓ Trust the team
```

---

## ❓ Mga Madalas Itanong

### Tungkol sa System Operations

**Q1: Walang sound alert sa order, ano ang gagawin?**

```
A: Mga Hakbang sa Pagsusuri
┌─────────────────────────────┐
│ 1. Check device volume      │
│    └─ Is tablet/PC volume on│
│                             │
│ 2. Check system settings    │
│    └─ Settings → Sound → On│
│                             │
│ 3. Test sound               │
│    └─ Click "Test Sound"    │
│                             │
│ 4. Reload page              │
│    └─ F5 or refresh         │
│                             │
│ 5. Clear browser cache      │
│    └─ Settings → Clear cache│
└─────────────────────────────┘
```

**Q2: Bakit hindi ko makita ang ilang order?**

```
A: Possible Reasons
┌─────────────────────────────┐
│ Reason 1: Filter is on      │
│ └─ Solution: Click "Show All│
│                             │
│ Reason 2: Other chef already│
│            accepted         │
│ └─ Solution: Normal         │
│                             │
│ Reason 3: Order cancelled   │
│ └─ Solution: Check cancel   │
│              records        │
│                             │
│ Reason 4: Workstation       │
│            restriction      │
│ └─ Solution: Contact owner  │
└─────────────────────────────┘
```

**Q3: Na-click ko nang mali ang button, ano ang gagawin?**

```
A: Status Rollback Function
┌─────────────────────────────┐
│ Within 30 sec after mistake:│
│                             │
│ 1. Click order card         │
│ 2. Click "⋯" more options   │
│ 3. Select "Rollback Status" │
│ 4. Confirm rollback         │
│                             │
│ Over 30 sec:                │
│ └─ Contact cashier/owner for│
│    manual adjustment        │
└─────────────────────────────┘
```

### Tungkol sa Order Processing

**Q4: Hindi malinaw ang order content, ano ang gagawin?**

```
A: Zoom Display Function
┌─────────────────────────────┐
│ Method 1: Click order card  │
│ └─ Pop-up detailed window   │
│                             │
│ Method 2: Adjust font size  │
│ └─ Settings → Display →     │
│    Large font               │
│                             │
│ Method 3: Voice reading     │
│            (new feature)    │
│ └─ System reads order       │
│    content                  │
└─────────────────────────────┘
```

**Q5: Maraming order ng parehong dish, paano mag-batch process?**

```
A: Batch Cooking Function
┌─────────────────────────────┐
│ Steps:                      │
│ 1. Enable "Batch Mode"      │
│ 2. Check orders to combine  │
│ 3. Click "Start Cooking (3)"│
│ 4. Mark complete one by one │
│                             │
│ Example:                    │
│ #020 Fried Rice x2 ☑        │
│ #021 Fried Rice x1 ☑        │
│ #023 Fried Rice x3 ☑        │
│ ────────────────            │
│ Total: 6 fried rice together│
└─────────────────────────────┘
```

**Q6: Sobrang daming order, hindi ko kayang gawin lahat, ano ang gagawin?**

```
A: Overload Response Strategy
┌─────────────────────────────┐
│ 1. Activate emergency mode  │
│    └─ System auto notifies  │
│       owner                 │
│                             │
│ 2. Prioritize overtime      │
│    orders                   │
│    └─ Red-marked first      │
│                             │
│ 3. Request support          │
│    └─ Other chefs assist    │
│                             │
│ 4. Temporarily pause orders │
│    └─ Owner can close online│
│       ordering              │
│                             │
│ 5. Honest communication     │
│    └─ Tell actual wait time │
└─────────────────────────────┘
```

### Tungkol sa Abnormal Situations

**Q7: Nawala ang internet, ano ang gagawin?**

```
A: Offline Mode Handling
┌─────────────────────────────┐
│ System downloaded orders:   │
│ ✓ Can continue viewing      │
│ ✓ Can continue cooking      │
│ ✗ Cannot update status      │
│                             │
│ Suggested actions:          │
│ 1. Record completed orders  │
│    on paper                 │
│ 2. Manually sync after      │
│    network restore          │
│ 3. Contact owner to explain │
│                             │
│ Emergency backup:           │
│ └─ Switch to manual ordering│
└─────────────────────────────┘
```

**Q8: Nag-crash ang tablet/computer?**

```
A: Device Failure Handling
┌─────────────────────────────┐
│ Immediate action:           │
│ 1. Login using backup device│
│    └─ Phone also works      │
│                             │
│ 2. Contact owner/IT         │
│    └─ Need technical support│
│                             │
│ 3. Temporary handling       │
│    └─ Verbal order confirm  │
│                             │
│ Prevention:                 │
│ • Regular device restart    │
│ • Keep software updated     │
│ • Backup device on standby  │
└─────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Common Technical Issues

```
┌─────────────────────────────────────────┐
│ Troubleshooting Quick Reference         │
├─────────────────────────────────────────┤
│                                         │
│  Issue: Blank screen                    │
│  ─────────                             │
│  ✓ Refresh page (F5)                    │
│  ✓ Clear cache and re-login             │
│  ✓ Check network connection             │
│                                         │
│  Issue: Orders not updating             │
│  ─────────                             │
│  ✓ Confirm network status               │
│  ✓ Check upper right connection light   │
│  ✓ Re-login to system                   │
│                                         │
│  Issue: Button not responding           │
│  ─────────                             │
│  ✓ Wait 3 sec and click again           │
│  ✓ Reload page                          │
│  ✓ Use different browser                │
│                                         │
│  Issue: Display garbled                 │
│  ─────────                             │
│  ✓ Adjust screen resolution             │
│  ✓ Zoom in/out page (Ctrl +/-)         │
│  ✓ Reopen browser                       │
│                                         │
└─────────────────────────────────────────┘
```

### Emergency Contact Methods

```
┌─────────────────────────────┐
│ When you need help:         │
├─────────────────────────────┤
│                             │
│ First Line: Shop owner/     │
│            manager          │
│ └─ On-site immediate        │
│    handling                 │
│                             │
│ Second Line: Technical      │
│             support         │
│ ├─ Phone: 0800-xxx-xxx      │
│ ├─ Email: support@xxx.com   │
│ └─ LINE: @makanmakan        │
│                             │
│ Emergency: System admin     │
│ └─ 24-hour hotline          │
│                             │
└─────────────────────────────┘
```

### System Maintenance Period

```
Regular Maintenance Time:

┌─────────────────────────────┐
│ Every Wed 2:00 AM - 4:00 AM │
│ (Off-peak hours)            │
├─────────────────────────────┤
│                             │
│ Maintenance includes:       │
│ • System updates            │
│ • Database optimization     │
│ • Performance improvement   │
│                             │
│ Impact:                     │
│ • May briefly cannot login  │
│ • In-progress orders        │
│   unaffected                │
│                             │
│ Notification:               │
│ • Day before system reminds │
│ • 1 hour before reminds     │
│   again                     │
└─────────────────────────────┘
```

---

## 📊 Performance Tracking

### Personal Statistics

Ang sistema ay awtomatikong nagrerekord ng iyong performance:

```
┌─────────────────────────────────────────┐
│ Chef Performance Dashboard              │
├─────────────────────────────────────────┤
│                                         │
│  Today's Stats: (2025-10-26)            │
│  ├─ Completed orders: 45                │
│  ├─ Average time: 11 min                │
│  ├─ On-time rate: 96%                   │
│  └─ Complaints: 0                       │
│                                         │
│  This Week Stats:                       │
│  ├─ Total orders: 276                   │
│  ├─ Fastest record: 3 min (Salad)       │
│  ├─ Most popular: Fried Rice (52)       │
│  └─ Customer satisfaction: 98%          │
│                                         │
│  Personal Ranking:                      │
│  ├─ Speed ranking: 2/5                  │
│  ├─ Quality score: 4.8/5.0              │
│  └─ Team contribution: 35%              │
│                                         │
└─────────────────────────────────────────┘
```

### Continuous Improvement

```
Direksyon ng pagpapabuti ng performance:

┌─────────────────────────────┐
│ 1. Speed Optimization       │
│    ├─ Familiarize with menu │
│    ├─ Full prep             │
│    └─ Smooth movements      │
│                             │
│ 2. Quality Control          │
│    ├─ Standardize process   │
│    ├─ Confirm before serving│
│    └─ Continuous learning   │
│                             │
│ 3. Communication &          │
│    Collaboration            │
│    ├─ Proactive reporting   │
│    ├─ Team coordination     │
│    └─ Share experience      │
│                             │
│ 4. System Utilization       │
│    ├─ Use functions well    │
│    ├─ Quick operations      │
│    └─ Data analysis         │
└─────────────────────────────┘
```

---

## 🎯 Mga Tuntunin sa Trabaho ng Chef

### Quality Standards

```
┌─────────────────────────────────────────┐
│ Checklist ng Kalidad ng Paghahain      │
├─────────────────────────────────────────┤
│                                         │
│  ✓ Temperature Confirmation             │
│    ├─ Hot food hot enough (>65°C)       │
│    └─ Cold food cold enough (<5°C)      │
│                                         │
│  ✓ Portion Confirmation                 │
│    ├─ Meets standard weight             │
│    └─ Correct side dish ratio           │
│                                         │
│  ✓ Appearance Check                     │
│    ├─ Neat plating                      │
│    ├─ Vibrant colors                    │
│    └─ No dirt                           │
│                                         │
│  ✓ Completeness Confirmation            │
│    ├─ All items present                 │
│    ├─ Complete condiments/accessories   │
│    └─ Correct utensils                  │
│                                         │
└─────────────────────────────────────────┘
```

### Kalinisan at Kaligtasan

```
┌─────────────────────────────┐
│ Mga Pangunahing Punto ng    │
│ Food Safety                 │
├─────────────────────────────┤
│ Personal Hygiene:           │
│ ✓ Wash hands before work    │
│ ✓ Wear work clothes & hat   │
│ ✓ Trim nails short          │
│ ✓ Don't wear jewelry        │
│                             │
│ Environmental Hygiene:      │
│ ✓ Keep workstation clean    │
│ ✓ Categorize ingredients    │
│ ✓ Separate raw & cooked     │
│ ✓ Timely garbage disposal   │
│                             │
│ Ingredient Handling:        │
│ ✓ Check expiration dates    │
│ ✓ Proper temp storage       │
│ ✓ Avoid cross-contamination │
│ ✓ Cook thoroughly           │
└─────────────────────────────┘
```

---

## 📱 System Quick Operations

### Keyboard Shortcuts

```
┌─────────────────────────────────────────┐
│ Shortcuts para Mapabuti ang Kahusayan  │
├─────────────────────────────────────────┤
│                                         │
│ F5             Refresh page             │
│ Ctrl + F       Search orders            │
│ Ctrl + P       Print order (if needed)  │
│ Spacebar       Start/Complete (when     │
│                order selected)          │
│ Esc            Close popup              │
│ ↑ ↓ ← →       Switch between orders     │
│ Tab            Switch input fields      │
│                                         │
└─────────────────────────────────────────┘
```

### Gesture Operations (Touch Screen)

```
┌─────────────────────────────┐
│ Touch Gestures              │
├─────────────────────────────┤
│ Single tap   Select order   │
│ Double tap   Quick start    │
│              cooking        │
│ Long press   Show more      │
│              options        │
│ Swipe left   Mark complete  │
│ Swipe right  Rollback/cancel│
│ Pinch        Zoom view      │
└─────────────────────────────┘
```

---

## 🌟 Konklusyon

Salamat sa paggamit ng MakanMakan Kitchen Display System!

```
┌─────────────────────────────────────────┐
│                                         │
│  Ikaw ang puso ng restaurant            │
│  Bawat putahe ay may dalang pag-asa     │
│  ng customer                            │
│  Ang sistema ay iyong katulong          │
│  Sama-sama nating likhain ang magandang │
│  karanasan sa pagkain                   │
│                                         │
│            👨‍🍳 Laban!                   │
│                                         │
└─────────────────────────────────────────┘
```

### Tandaan ang Mga Prinsipyong Ito

✅ **Quality First** - Hindi kailanman ikompromiso
✅ **Efficiency Supreme** - Pero hindi isasakripisyo ang kalidad
✅ **Teamwork** - Ang komunikasyon ay susi
✅ **Continuous Learning** - Patuloy na pagpapabuti
✅ **Maintain Passion** - Mahalin ang pagluluto

---

## 📞 Kailangan ng Tulong?

**Technical Support**: support@makanmakan.com
**Customer Service Hotline**: 0800-123-456
**Online Documentation**: docs.makanmakan.com
**Community Support**: Facebook / LINE Official Account

---

<div align="center">

**MakanMakan Chef Operations Manual**

Gawing mas matalino ang pamamahala ng kusina, gawing mas focused ang pagluluto

**Version 2.0** | **2025-10-26**

Built with ❤️ for all chefs

</div>
