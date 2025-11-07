# 🚀 Gabay sa Paggamit ng MakanMakan para sa Service Crew

> **Bersyon**: 2.0
> **Huling Na-update**: 2025-10-26
> **Para sa**: Service Crew ng Restaurant, Wait Staff

---

## 📚 Talaan ng Nilalaman

1. [Mabilis na Pagsisimula](#mabilis-na-pagsisimula)
2. [Pangkalahatang-tanaw ng Sistema](#pangkalahatang-tanaw-ng-sistema)
3. [Pag-login at Pangunahing Operasyon](#pag-login-at-pangunahing-operasyon)
4. [Pamamahala ng Order](#pamamahala-ng-order)
5. [Proseso ng Paghahatid](#proseso-ng-paghahatid)
6. [Pamamahala ng Status ng Order](#pamamahala-ng-status-ng-order)
7. [Serbisyo sa Customer](#serbisyo-sa-customer)
8. [Pagtatala ng Trabaho](#pagtatala-ng-trabaho)
9. [Paghawak ng Emerhensya](#paghawak-ng-emerhensya)
10. [Mga Madalas Itanong](#mga-madalas-itanong)

---

## 🚀 Mabilis na Pagsisimula

### Maligayang Pagdating sa MakanMakan Team!

Bilang service crew, ikaw ang mahalagang tulay sa pagitan ng restaurant at mga customer. Ang iyong pangunahing responsibilidad ay:

```
┌─────────────────────────────────────────┐
│ Pangunahing Responsibilidad             │
├─────────────────────────────────────────┤
│                                         │
│  ✅ Tumanggap at tingnan ang mga bagong│
│     order                               │
│  ✅ Kunin ang pagkain mula sa kusina   │
│  ✅ Ihatid sa tamang mesa/upuan        │
│  ✅ I-update ang delivery status       │
│  ✅ Tumugon sa mga kahilingan ng       │
│     customer                            │
│  ✅ Panatilihin ang mataas na kalidad  │
│     ng serbisyo                         │
│                                         │
└─────────────────────────────────────────┘
```

### Pangkalahatang Daloy ng Trabaho sa Isang Araw

```
08:00 Mag-login → Tingnan ang iskedyul
   ↓
09:00 Maghanda → Suriin ang mga kubyertos
   ↓
11:00 Simulan ang serbisyo → Tumanggap ng order
   ↓
11:30 Peak hours → Mabilis na paghahatid
   ↓
14:00 Break time → Linisin ang kapaligiran
   ↓
17:00 Paghanda para sa hapunan → Suriin muli
   ↓
21:00 Pagtatapos → Mag-record at mag-report
   ↓
21:30 Mag-sign out → Kumpletuhin ang daily tasks
```

---

## 🏢 Pangkalahatang-tanaw ng Sistema

### Ang Iyong Papel sa Koponan

```
        May-ari
         │
    ┌────┼────┬────┐
    ↓    ↓    ↓    ↓
  Kusinero Service Cashier Customer
           Crew
    │    │    │    │
    └────┴────┴────┘
         │
   Real-time Order System
```

**Paliwanag ng Papel**:
- **Kusinero**: Naghahanda ng pagkain → Nag-notify ng pickup
- **Ikaw (Service Crew)**: Kumuha → Maghatid → I-update ang status
- **Cashier**: Magproseso ng bayad → Kumpletuhin ang order
- **Customer**: Umorder → Maghintay → Kumain

### Saklaw ng Karapatan

```
┌─────────────────────────────────────────┐
│ Mga Aksyon na Maaari Mong Gawin        │
├─────────────────────────────────────────┤
│                                         │
│  ✅ Tingnan ang listahan ng pending    │
│     delivery orders                     │
│  ✅ Tingnan ang detalye ng order       │
│  ✅ I-update ang order sa "Delivering" │
│  ✅ I-update ang order sa "Delivered"  │
│  ✅ Tingnan ang impormasyon ng mesa    │
│  ✅ Tingnan ang personal work records  │
│  ✅ I-edit ang personal profile        │
│                                         │
│  ❌ Hindi maaaring baguhin ang presyo  │
│     ng menu                             │
│  ❌ Hindi maaaring burahin ang order   │
│  ❌ Hindi maaaring tingnan ang kita    │
│  ❌ Hindi maaaring pamahalaan ang ibang│
│     empleyado                           │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔐 Pag-login at Pangunahing Operasyon

### Proseso ng Unang Pag-login

```
┌──────────────────────────────────────────┐
│ Mga Hakbang sa Pag-login                 │
├──────────────────────────────────────────┤
│                                          │
│  1️⃣ Buksan ang MakanMakan Service Crew  │
│      App                                 │
│      ↓                                   │
│  2️⃣ Ilagay ang username at password na  │
│      binigay ng may-ari                  │
│      ↓                                   │
│  3️⃣ Palitan ang password sa unang       │
│      pag-login                           │
│      ↓                                   │
│  4️⃣ Kumpletuhin ang personal profile    │
│      ↓                                   │
│  5️⃣ Pumasok sa service crew workspace   │
│                                          │
└──────────────────────────────────────────┘
```

### Halimbawa ng Login Credentials

| Item | Paliwanag | Halimbawa |
|------|-----------|-----------|
| Username | Employee account na ginawa ng may-ari | crew001 o your.email@example.com |
| Initial Password | Pansamantalang password mula sa may-ari | Temp123456 |
| Kinakailangan sa Bagong Password | Hindi bababa sa 8 character, may letra at numero | MyPass2025! |

### Unang Pag-login Checklist

✅ **Palitan ang Default Password**
- Magtakda ng secure at madaling tandaan na password
- Huwag ibahagi sa iba

✅ **Kumpletuhin ang Personal Profile**
- Mag-upload ng profile photo (opsyonal)
- Punan ang contact phone
- Kumpirmahin ang emergency contact

✅ **Maging Pamilyar sa Interface**
- I-browse ang pangunahing function areas
- Subukan ang order viewing function
- Maintindihan ang paraan ng pag-update ng status

---

## 📋 Pamamahala ng Order

### Order Display Interface

```
┌─────────────────────────────────────────────┐
│ 🍽️ Mga Pending Delivery                    │
├─────────────────────────────────────────────┤
│                                             │
│  【Order #1234】                🔴 Bago     │
│  ┌─────────────────────────────────────┐   │
│  │ 🕐 11:23  📍 Mesa A3  👥 4 tao      │   │
│  │                                     │   │
│  │ 🍜 Beef Noodles x 2                │   │
│  │ 🥤 Iced Tea x 2                    │   │
│  │ 🍲 Mixed Appetizers x 1            │   │
│  │                                     │   │
│  │ 💬 Tandaan: Walang anghang sa beef │   │
│  │    noodles                          │   │
│  │                                     │   │
│  │ [🍳 Tapos na sa Kusina] [📦 Handa] │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  【Order #1235】                🟡 Cooking  │
│  ┌─────────────────────────────────────┐   │
│  │ 🕐 11:25  📍 Mesa B2  👥 2 tao      │   │
│  │                                     │   │
│  │ 🍛 Curry Rice x 1                  │   │
│  │ 🥗 Garden Salad x 1                │   │
│  │                                     │   │
│  │ [🍳 Naghahanda sa Kusina]           │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### Paliwanag ng Status ng Order

```
┌─────────────────────────────────────────┐
│ Daloy ng Status ng Order                │
├─────────────────────────────────────────┤
│                                         │
│  🆕 Bagong Order                       │
│   ↓                                     │
│  🍳 Naghahanda sa Kusina (Kusinero)    │
│   ↓                                     │
│  ✅ Tapos na sa Kusina → 📦 Handa na   │
│     Kunin                               │
│   ↓                                     │
│  🚶 Delivering (Ikaw)                  │
│   ↓                                     │
│  ✅ Naihatid Na (Ikaw)                 │
│   ↓                                     │
│  💰 Nabayaran Na (Cashier)             │
│   ↓                                     │
│  🎉 Kumpleto ang Order                 │
│                                         │
└─────────────────────────────────────────┘
```

### Gabay sa Impormasyon ng Order

| Icon/Label | Kahulugan | Ang Iyong Aksyon |
|-----------|-----------|------------------|
| 🔴 Bagong Order | Kakaorder lang | Bantayan ang progreso sa kusina |
| 🟡 Cooking | Naghahanda sa kusina | Maghintay ng pickup notification |
| 🟢 Handa Na | Tapos na ang pagkain | **Kunin kaagad** |
| 🔵 Delivering | Ikaw ay naghahatid | Ihatid agad |
| ✅ Naihatid Na | Naihatid na ang pagkain | Tapos ang task |

### Order Filter Function

Pumunta sa: **Workspace → Order List → Filter**

```
Mga Opsyon sa Filter:
  ├─ 📦 Handa nang Kunin (Pinaka-ginagamit)
  ├─ 🚶 Delivering
  ├─ ✅ Nakumpleto Ngayong Araw
  ├─ 📍 I-filter ayon sa Mesa
  └─ 🕐 Ayusin ayon sa Oras
```

---

## 🍽️ Proseso ng Paghahatid

### Standard na Mga Hakbang sa Paghahatid

```
┌─────────────────────────────────────────────┐
│ Standard na Proseso ng Paghahatid (SOP)     │
├─────────────────────────────────────────────┤
│                                             │
│  Hakbang 1: Makatanggap ng Pickup           │
│             Notification                    │
│  ─────────────────────────                  │
│   ✓ Ipapakita ng sistema ang "📦 Handa"    │
│   ✓ Suriin ang order number at mesa        │
│   ✓ Kumpirmahin ang mga item ng pagkain    │
│                                             │
│  Hakbang 2: Pumunta sa Kusina upang Kunin  │
│  ─────────────────────────                  │
│   ✓ Kumpirmahin ang order number sa        │
│     kusinero                                │
│   ✓ I-verify ang mga item at dami         │
│   ✓ Suriin ang hitsura at temperatura ng  │
│     pagkain                                 │
│   ✓ Maghanda ng mga kubyertos at sawsawan │
│                                             │
│  Hakbang 3: I-update sa "Delivering"       │
│  ─────────────────────────                  │
│   ✓ I-click ang order card                 │
│   ✓ Piliin ang "🚶 Simulan ang Delivery"  │
│   ✓ Ino-notify ng sistema ang customer na │
│     "Delivering"                            │
│                                             │
│  Hakbang 4: Ihatid sa Mesa                 │
│  ─────────────────────────                  │
│   ✓ Kumpirmahin ang numero ng mesa/upuan  │
│   ✓ Batiin ang customer nang magalang     │
│   ✓ Ilagay ang pagkain at ipaliwanag      │
│   ✓ Magtanong kung may kailangan pa       │
│                                             │
│  Hakbang 5: Kumpirmahin ang Paghahatid     │
│  ─────────────────────────                  │
│   ✓ I-click ang "✅ Naihatid Na" button    │
│   ✓ Ire-record ng sistema ang oras ng     │
│     pagkumpleto                             │
│   ✓ Magpatuloy sa susunod na order        │
│                                             │
└─────────────────────────────────────────────┘
```

### Checklist sa Pagkuha ng Pagkain

Kapag kumukuha mula sa kusina, i-verify ang:

| Check Item | Kumpirmahing Nilalaman |
|-----------|----------------------|
| ✅ Order Number | Itugma sa ipinapakita ng sistema |
| ✅ Mga Item ng Pagkain | I-verify ang pangalan at dami |
| ✅ Kabuuan | Side dishes, sawsawan, kubyertos |
| ✅ Kondisyon ng Pagkain | Mainit ang mainit, malamig ang malamig |
| ✅ Hitsura | Maayos ang pagkakalagay, walang tagas |
| ✅ Mga Espesyal na Kahilingan | Suriin ang mga tala (hal.: walang anghang, vegetarian) |

### Etiketa sa Paghahatid ng Serbisyo

```
┌─────────────────────────────────────────┐
│ Etiketa sa Serbisyo                     │
├─────────────────────────────────────────┤
│                                         │
│  ✅ DO - Mga Best Practice             │
│  ─────────────────                      │
│  • Ngumiti at bumati: "Hello po, eto   │
│    na po ang inyong order"             │
│  • Magsalita nang mahina, huwag        │
│    abalahin ang iba                     │
│  • Mag-ingat sa paglalagay, iwasan ang │
│    pagkatapon                           │
│  • Ipakilala ang mga specialty: "Ito po│
│    ang signature dish natin"           │
│  • Magtanong: "May kailangan pa po ba  │
│    kayo?"                               │
│  • Magpahiwatig ng mabuti: "Enjoy po sa│
│    inyong pagkain"                      │
│                                         │
│  ❌ DON'T - Iwasang Gawin              │
│  ─────────────────────                  │
│  • Maling mesa, hindi nag-verify       │
│  • Malamig na ugali, walang eye contact│
│  • Bastos sa paghawak ng plato         │
│  • Nakalimutan ang kubyertos o sawsawan│
│  • Hindi nag-update ng status pagkatapos│
│    maghatid                             │
│  • Hindi pinansin ang tanong ng customer│
│                                         │
└─────────────────────────────────────────┘
```

### Paghahatid ng Maraming Order

Kapag naghahatid ng maraming order nang sabay-sabay:

```
Matalinong Estratehiya sa Paghahatid:

  📍 Mag-plano ng ruta ayon sa mga zone ng mesa
     │
     ├─ Zone A tables (A1-A5)
     ├─ Zone B tables (B1-B5)
     └─ Zone C tables (C1-C5)

  🎯 Batch pickup at delivery
     │
     ├─ Parehong zone → Ihatid nang sama-sama
     ├─ Iba't ibang zone → Maghiwalay na batch
     └─ Mainit na pagkain muna → Panatilihin ang
         temperatura
```

**Halimbawa**:

```
Sitwasyon: 3 order na naghihintay

Order #1234 → Mesa A3 → Beef Noodles (mainit)
Order #1235 → Mesa A5 → Fried Rice (mainit)
Order #1236 → Mesa B2 → Smoothie (malamig)

✅ Pinakamahusay na Estratehiya:
  1. Kunin ang mainit na pagkain ng A3, A5
     (parehong zone)
  2. Ihatid sa A3 → A5 (mabilis na ruta)
  3. Bumalik para sa malamig na inumin ng B2
  4. Ihatid sa B2

⏱️ Nakatipid na Oras: 5-10 minuto
```

---

## 🔄 Pamamahala ng Status ng Order

### Paano Mag-update ng Status ng Order

```
┌──────────────────────────────────────────┐
│ Mga Hakbang sa Pag-update ng Status      │
├──────────────────────────────────────────┤
│                                          │
│  Paraan 1: Direktang pag-update sa       │
│            listahan ng order             │
│  ───────────────────────────              │
│                                          │
│   [Order #1234]  [📦 Simulan ang        │
│                       Delivery]          │
│                      ↑                   │
│                  I-click ang button na ito│
│                                          │
│  Paraan 2: Mag-update sa pamamagitan ng  │
│            order details                 │
│  ───────────────────────────              │
│                                          │
│   [Order #1234] → I-click para tingnan   │
│                   ang detalye            │
│         ↓                                │
│   【Order Details Page】                 │
│   [I-update ang Status: Delivering ▼]   │
│         ↓                                │
│   Piliin ang bagong status → Kumpirmahin│
│                                          │
└──────────────────────────────────────────┘
```

### Panahon ng Pag-update ng Status

| Kasalukuyang Status | I-update sa | Kailan |
|-------------------|-------------|--------|
| 🟢 Handa Na | 🚶 Delivering | **Pagkatapos kunin, bago umalis** |
| 🚶 Delivering | ✅ Naihatid Na | **Pagkatapos ilagay ang pagkain sa mesa** |

### Kahalagahan ng Pag-update ng Status

```
Bakit kailangan agad mag-update ng status?

  1. 📱 Real-time tracking ng customer
     └─ Ipapakita ng customer app ang progreso
        ng delivery

  2. 🏢 Susubaybayan ng may-ari ang efficiency
     └─ Susuriin ng admin dashboard ang oras ng
        delivery

  3. 📊 Estadistika ng sistema
     └─ I-optimize ang alokasyon ng manpower

  4. 🤝 Maayos na kolaborasyon ng koponan
     └─ Maintindihan ng ibang staff ang sitwasyon
```

---

## 🤝 Serbisyo sa Customer

### Mga Karaniwang Kahilingan ng Customer

```
┌─────────────────────────────────────────┐
│ Mga Kahilingan ng Customer at Tugon     │
├─────────────────────────────────────────┤
│                                         │
│  Kahilingan 1: "Pwede po ba ng chopsticks?"│
│  Tugon: "Sige po, kukunin ko na"       │
│  Aksyon: Ibigay kaagad                  │
│                                         │
│  Kahilingan 2: "Nasaan na po ang order  │
│                 namin?"                 │
│  Tugon: "Sorry po, tsekin ko po"        │
│  Aksyon: Suriin ang status → Kumpirmahin│
│          sa kusina                      │
│                                         │
│  Kahilingan 3: "Masyadong maanghang ito,│
│                 pwede bang palitan?"    │
│  Tugon: "Pasensya na po, tatawag ko ang │
│          manager"                       │
│  Aksyon: Ipaalam sa may-ari o supervisor│
│                                         │
│  Kahilingan 4: "Pwede po bang kunan kami│
│                 ng litrato?"            │
│  Tugon: "Oo naman po!"                  │
│  Aksyon: Tumulong sa pagkuha ng litrato,│
│          magpakita ng init              │
│                                         │
│  Kahilingan 5: "Gusto na po naming      │
│                 magbayad"               │
│  Tugon: "Sige po, tatawagin ko ang      │
│          cashier"                       │
│  Aksyon: Ipaalam sa cashier             │
│                                         │
└─────────────────────────────────────────┘
```

### Mga Pamantayan sa Ugali sa Serbisyo

```
🌟 5 Susi sa Mahusay na Serbisyo

  1️⃣ Ngiti (Smile)
     └─ Panatilihing nakangiti nang palakaibigan

  2️⃣ Eye Contact
     └─ Ipakita na nakikinig ka nang mabuti

  3️⃣ Mabilis na Tugon (Quick Response)
     └─ Tumugon sa loob ng 30 segundo

  4️⃣ Malinaw na Komunikasyon (Clear Communication)
     └─ Siguruhing nauunawaan ng customer

  5️⃣ Dagdag na Pag-aalaga (Extra Care)
     └─ Serbisyo na lampas sa inaasahan
```

### Mga Hakbang sa Paghawak ng Reklamo

```
┌──────────────────────────────────────────┐
│ SOP sa Paghawak ng Reklamo ng Customer   │
├──────────────────────────────────────────┤
│                                          │
│  Hakbang 1: Makinig at Humingi ng Paumanhin│
│  ───────────────────                      │
│   • Huwag manggambala, makinig nang      │
│     matiyaga                             │
│   • Magpahayag ng paumanhin: "Pasensya na│
│     po sa abala"                         │
│                                          │
│  Hakbang 2: Kumpirmahin ang Isyu         │
│  ───────────────────                      │
│   • Ulitin ang isyu: "Ibig pong sabihin...│
│     tama po ba?"                         │
│   • Siguruhing lubos na nauunawaan       │
│                                          │
│  Hakbang 3: Mag-alok ng Solusyon         │
│  ───────────────────                      │
│   • Maliit na isyu: Hawakan kaagad      │
│   • Malaking isyu: Kumuha ng supervisor │
│                                          │
│  Hakbang 4: Isakatuparan at Subaybayan   │
│  ───────────────────                      │
│   • Mabilis na ipatupad ang solusyon    │
│   • Kumpirmahin ang kasiyahan ng customer│
│                                          │
│  Hakbang 5: Mag-record at Mag-report     │
│  ───────────────────                      │
│   • Itala ang insidente sa sistema      │
│   • I-report ang malubhang isyu sa      │
│     supervisor                           │
│                                          │
└──────────────────────────────────────────┘
```

---

## 📊 Pagtatala ng Trabaho

### Tingnan ang Personal na Estadistika

Pumunta sa: **Profile → Work Records**

```
┌─────────────────────────────────────────┐
│ 📊 Estadistika ng Linggong Ito         │
├─────────────────────────────────────────┤
│                                         │
│  🚀 Nakumpletong Order: 127            │
│  ⏱️ Average na Oras ng Delivery: 4.2  │
│     minuto                              │
│  ⭐ Rating ng Customer: 4.8 / 5.0     │
│  🏆 Grade ng Serbisyo: Mahusay         │
│                                         │
│  📈 Araw-araw na Trend ng Delivery     │
│  ───────────────────                    │
│   Lun: ████████░░ 18 order            │
│   Mar: ██████████ 22 order            │
│   Miy: ███████░░░ 15 order            │
│   Huw: █████████░ 20 order            │
│   Biy: ████████████ 28 order          │
│   Sab: ██████████████ 32 order        │
│   Lin: ████████░░ 16 order            │
│                                         │
└─────────────────────────────────────────┘
```

### Tingnan ang Detalyadong Tala ng Delivery

```
Listahan ng Tala ng Delivery
  │
  ├─ [2025-10-26 12:30] Order #1234
  │   └─ Mesa A3 → Oras: 3m 45s ✅
  │
  ├─ [2025-10-26 12:45] Order #1235
  │   └─ Mesa B2 → Oras: 4m 12s ✅
  │
  ├─ [2025-10-26 13:00] Order #1236
  │   └─ Mesa C5 → Oras: 5m 30s ✅
  │
  └─ [2025-10-26 13:15] Order #1237
      └─ Mesa A1 → Oras: 3m 20s ✅
```

### Paliwanag ng Performance Metrics

| Metric | Paliwanag | Target |
|--------|-----------|--------|
| Average na Oras ng Delivery | Mula sa pagkuha hanggang paghahatid | < 5 minuto |
| Nakumpletong Order | Araw-araw na matagumpay na delivery | Nakadepende sa shift |
| Rating ng Customer | Batay sa mga review | ≥ 4.5 / 5.0 |
| On-time Rate | Naihatid sa loob ng tinantyang oras | ≥ 95% |

---

## 🚨 Paghawak ng Emerhensya

### Mga Karaniwang Emerhensyang Sitwasyon

```
┌─────────────────────────────────────────┐
│ Gabay sa Pagtugon sa Emerhensya         │
├─────────────────────────────────────────┤
│                                         │
│  Sitwasyon 1: Natapon ang pagkain habang│
│               naghahatid                │
│  ───────────────────────                │
│   1. Linisin kaagad ang lugar           │
│   2. Ipaalam sa kusina na gumawa muli  │
│   3. Humingi ng paumanhin sa customer  │
│   4. Magbigay ng tinantyang oras ng    │
│      paghihintay                        │
│   5. Itala ang insidente at mag-report │
│                                         │
│  Sitwasyon 2: Maling mesa ang napaghatiran│
│  ───────────────────────                │
│   1. Kumpirmahin kaagad ang tamang numero│
│      ng mesa                            │
│   2. Humingi ng paumanhin sa maling mesa│
│   3. Kunin ang pagkain at ihatid sa     │
│      tamang mesa                        │
│   4. Suriin kung kailangan palitan ang │
│      pagkain                            │
│                                         │
│  Sitwasyon 3: Hindi nasiyahan ang customer│
│                sa pagkain               │
│  ───────────────────────                │
│   1. Makinig at itala ang isyu         │
│   2. Ipaalam kaagad sa supervisor      │
│   3. Huwag mag-promise ng refund/       │
│      replacement                        │
│   4. Samahan ang supervisor sa paghawak│
│      ng problema                        │
│                                         │
│  Sitwasyon 4: Sira ang sistema, hindi   │
│                maka-update ng status    │
│  ───────────────────────                │
│   1. Magpatuloy sa serbisyo ng paghahatid│
│   2. Itala sa papel ang mga order number│
│   3. Ipaalam sa tech support o supervisor│
│   4. I-update ang mga tala pagkatapos   │
│      bumalik ang sistema                │
│                                         │
│  Sitwasyon 5: Sobrang dami ng order sa  │
│                peak hour                │
│  ───────────────────────                │
│   1. Manatiling kalmado, hawakan nang   │
│      maayos                             │
│   2. Unahin ang mainit na pagkain      │
│   3. Batch process ng mga order sa      │
│      parehong zone                      │
│   4. Humingi ng tulong kung kailangan  │
│                                         │
└─────────────────────────────────────────┘
```

### Mga Emergency Contact

```
📞 Listahan ng Emergency Contact
   │
   ├─ Manager/Supervisor: [Extension] o [Mobile]
   ├─ Head Chef: [Extension]
   ├─ Cashier: [Extension]
   └─ Tech Support: support@makanmakan.com
```

### Pag-report ng Insidente

Para sa mga insidenteng kailangan i-document:

Pumunta sa: **Profile → Incident Report**

```
Form ng Incident Report
  │
  ├─ Uri ng Insidente: [Dropdown]
  ├─ Oras ng Pangyayari: [Auto-filled]
  ├─ Kaugnay na Order: [Order Number]
  ├─ Paglalarawan ng Insidente: [Detalyadong
  │   paliwanag]
  ├─ Aksyon na Ginawa: [Mga hakbang na ginawa]
  └─ Litrato bilang Patunay: [I-upload ang
      litrato (opsyonal)]
```

---

## ❓ Mga Madalas Itanong

### Q1: Paano kung nakalimutan ko ang password?

```
A: Mga Hakbang sa Pag-reset ng Password

  1. I-click ang "Forgot Password" sa login page
     ↓
  2. Ilagay ang employee ID o email mo
     ↓
  3. Magpapadala ang sistema ng reset link sa
     email mo
     ↓
  4. I-click ang link para magtakda ng bagong
     password
     ↓
  5. Kung hindi pa rin, makipag-ugnayan sa
     may-ari
```

---

### Q2: Ipinakikita ng order na "Handa Na" pero sabi ng kusina hindi pa tapos?

```
A: Posibleng delay sa pag-update ng status

  ✅ Tamang Diskarte:
     • Kumpirmahin sa kusinero
     • Pagkatiwalaan ang pasya ng kusinero
     • Maghintay na tunay na matapos
     • Huwag magmadali sa kusina
     • I-report kung madalas mangyari
```

---

### Q3: Sinabi ng customer na may mali sa order, ano ang gagawin?

```
A: Paghawak ng Pagkakamali sa Order

  Hakbang 1: Tingnan ang detalye ng order sa
             sistema
         └─ Kumpirmahin kung pagkakamali ng
            customer o sistema

  Hakbang 2: Kung mali ang inorder ng customer
         └─ Magalang na ipaliwanag "Ito po ang
            inorder ninyo"
         └─ Tanungin kung gusto pang mag-add ng
            iba
         └─ I-guide sa cashier para sa consultation

  Hakbang 3: Kung mali ang ginawa ng kusina
         └─ Humingi kaagad ng paumanhin
         └─ Ipaalam sa kusina na gumawa muli
         └─ Ipaalam sa customer ang oras ng
            paghihintay

  Hakbang 4: Itala ang insidente
         └─ Mag-iwan ng note sa sistema
         └─ Maikling report sa supervisor
```

---

### Q4: Masyadong maraming order sa peak hour, hindi kayang sundan?

```
A: Mga Estratehiya sa Peak Hour

  🎯 Estratehiya ng Priority
     │
     ├─ Priority 1: Mga order na naghihintay > 10 min
     ├─ Priority 2: Mainit na pagkain (iwasang
     │              lumamig)
     ├─ Priority 3: Maraming order sa parehong zone
     │              (batch)
     └─ Priority 4: Malamig na inumin, desserts

  🤝 Humingi ng Tulong
     │
     ├─ Humingi ng suporta sa ibang crew
     ├─ Sabihin sa supervisor na kailangan ng tao
     └─ Unahin ng kusina ang mga lumang order

  💡 Pagpapahusay ng Efficiency
     │
     ├─ Gumamit ng tray para magdala ng maraming
     │   order
     ├─ Mag-plano ng pinakamaikling ruta ng delivery
     └─ Bawasan ang pag-ikot sa kusina
```

---

### Q5: Pwede ba akong gumamit ng sariling phone para tingnan ang mga order?

```
A: Nakadepende sa patakaran ng restaurant

  ✅ Kung nagbibigay ang restaurant ng mobile app:
     • Pwedeng gamitin ang sariling phone
     • I-download ang MakanMakan Service Crew App
     • Mag-login gamit ang employee credentials
     • Siguruhing stable ang internet connection

  ⚠️ Kung gumagamit ng tablet ng restaurant:
     • Gamitin lang ang ibinigay na equipment
     • Huwag mag-install ng app nang pribado
     • Huwag mag-login sa personal devices
     • Sundin ang information security policy
```

---

### Q6: Walang tugon ang customer pagkatapos maghatid, i-update pa rin ba sa "Naihatid Na"?

```
A: Oo! Naihatid = I-update

  ✅ Tamang Diskarte:
     • Pagkain sa mesa = Naihatid
     • Hindi na kailangan ng kumpirmasyon ng customer
     • I-update kaagad ang status
     • Magpatuloy sa susunod na order

  ℹ️ Paliwanag:
     • Makikita ng customer sa app ang delivery
     • Tatawag ang customer kung may problema
     • Huwag mag-delay para sa kumpirmasyon
```

---

### Q7: Paano mapapabilis ang delivery?

```
A: Mga Tip sa Pagpapahusay ng Efficiency

  ⚡ Mga Paraan ng Pag-optimize ng Bilis
     │
     ├─ 1. Kabisaduhin ang layout ng mga mesa
     │      └─ Alamin ang lokasyon ng mga mesa sa
     │         bawat zone
     │
     ├─ 2. Batch process ng mga order
     │      └─ Ihatid nang sabay ang mga order sa
     │         parehong zone
     │
     ├─ 3. Maghanda ng mga kubyertos nang maaga
     │      └─ Kunin na lahat habang nagpi-pickup
     │
     ├─ 4. Mag-plano ng pinakamaikling ruta
     │      └─ Iwasan ang pag-ikot nang malayo
     │
     ├─ 5. Panatilihing maayos ang workspace
     │      └─ Bawasan ang oras ng paghahanap
     │
     └─ 6. Gumamit ng tray o cart
            └─ Magdala ng mas maraming pagkain nang
               sabay

  📊 Pagtakda ng Target
     • Average na oras ng delivery: < 5 min
     • Pickup hanggang delivery: < 3 min
     • Kasiyahan ng customer: ≥ 4.5 stars
```

---

### Q8: Pwede ba akong gumamit ng phone habang nagtatrabaho?

```
A: Sundin ang mga patakaran ng restaurant

  ✅ Mga Pinapayagang Gamit:
     • Tingnan ang mga order sa MakanMakan app
     • Emergency contact sa pamilya
     • Sagutin ang tawag ng supervisor
     • Mga bagay na may kinalaman sa trabaho

  ❌ Hindi Pinapayagan:
     • Mag-browse ng social media habang
       nagtatrabaho
     • Mag-chat, maglaro ng games
     • Mag-selfie (maliban kung pinapayagan)
     • Anumang gamit na nakakaapekto sa efficiency
       ng trabaho

  📱 Prinsipyo sa Paggamit:
     • Malayang gamitin sa break time
     • Unahin ang trabaho sa shift
     • Mag-request ng leave para sa emerhensya
```

---

### Q9: Nag-alok ang customer ng tip, pwede bang tanggapin?

```
A: Sundin ang patakaran ng restaurant

  Plan A: Bawal ang Tips
     • Magalang na tanggihan: "Salamat po, trabaho
       po namin ito"
     • Ipaliwanag ang patakaran ng restaurant
     • Kung pinipilit ng customer, tanungin ang
       supervisor

  Plan B: Pinapayagan ang Tips
     • Magalang na pasalamatan: "Salamat po sa
       encouragement"
     • I-declare o ipasa ayon sa kinakailangan
     • Sundin ang sistema ng pamamahagi ng tip

  ⚠️ Mahalagang Tandaan:
     • Huwag aktibong humingi ng tip
     • Huwag baguhin ang serbisyo dahil sa tip
     • Magbigay ng pantay na mataas na kalidad ng
       serbisyo sa lahat
```

---

### Q10: Paano kung makatagpo ng hindi palakaibigan na customer?

```
A: Propesyonal na Pagtugon

  🛡️ Estratehiya ng Pagtugon
     │
     ├─ Manatiling kalmado
     │   └─ Huwag tumugon nang emosyonal
     │
     ├─ Propesyonal na ugali
     │   └─ Panatilihing magalang at respetuoso
     │
     ├─ Makinig sa mga reklamo
     │   └─ Hayaang matapos magsalita
     │
     ├─ Humingi ng paumanhin nang nararapat
     │   └─ "Pasensya na po sa abala"
     │
     ├─ Humingi ng tulong
     │   └─ Hilingin sa supervisor na makialam
     │
     └─ Protektahan ang sarili
         └─ Kung may verbal attack o banta, i-report
            kaagad

  💬 Standard na Tugon:
     "Pasensya na po sa abala.
      Tatawag po ako ng supervisor para tulungan
      kayo."

  📝 Follow-up:
     • Itala ang detalye ng insidente
     • I-report sa supervisor
     • Huwag personal na kunin, magpatuloy sa
       propesyonal na trabaho
```

---

## 🎯 Mga Lihim sa Pagiging Mahusay na Service Crew

### Ugali at Pag-iisip

```
┌─────────────────────────────────────────┐
│ Mga Katangian ng Mahusay na Service Crew│
├─────────────────────────────────────────┤
│                                         │
│  💪 Proactive                          │
│     └─ Hanapin ang mga pangangailangan │
│        nang hindi sinasabi              │
│                                         │
│  ⚡ Mabilis na Tugon                   │
│     └─ Mabilis na tumugon sa mga       │
│        customer                         │
│                                         │
│  😊 Palakaibigan                       │
│     └─ Ang tunay na ngiti ay lampas sa │
│        salita                           │
│                                         │
│  🎯 Mapagmasid                         │
│     └─ Pansinin ang mga detalye,       │
│        ihanda ang mga pangangailangan   │
│                                         │
│  🤝 Pakikipagtulungan                  │
│     └─ Makipagtulungan sa kusina/cashier│
│                                         │
│  📚 Patuloy na Pag-aaral                │
│     └─ Maging pamilyar sa bagong menu/ │
│        features                         │
│                                         │
│  💎 Propesyonal na Imahe               │
│     └─ Maayos na hitsura, wastong asal │
│                                         │
└─────────────────────────────────────────┘
```

### Landas ng Career Development

```
Hagdan ng Career ng Service Crew
   │
   ├─ Level 1: Junior Service Crew
   │   └─ Matuto ng basic delivery process
   │
   ├─ Level 2: Senior Service Crew
   │   └─ Hawakan ang iba't ibang sitwasyon nang
   │      mag-isa
   │
   ├─ Level 3: Service Team Leader
   │   └─ Gabayan ang mga baguhan, koordinahin ang
   │      trabaho
   │
   ├─ Level 4: Floor Supervisor
   │   └─ Pamahalaan ang buong service team
   │
   └─ Level 5: Manager/Operations Manager
       └─ Pangkalahatang operasyon ng restaurant
```

---

## 📞 Kailangan ng Tulong?

### Internal Support

```
🆘 Pagkakasunod-sunod ng Kahilingan ng Tulong

  1️⃣ Senior Service Crew (Tulong ng kapwa)
     ↓
  2️⃣ Team Leader (On-site supervisor)
     ↓
  3️⃣ Manager (Pangkalahatang pamamahala)
     ↓
  4️⃣ Tech Support (Mga isyu sa sistema)
```

### Impormasyon sa Pakikipag-ugnayan

- **Mga Isyu sa Sistema/Teknikal**: support@makanmakan.com
- **Mga Isyu sa Paggamit ng App**: In-system "Help Center"
- **Mga Isyu na May Kinalaman sa Trabaho**: Makipag-ugnayan direkta sa supervisor

---

## 🌟 Konklusyon

Salamat sa pagpili mong maging bahagi ng MakanMakan team!

Bilang service crew, ikaw ang mahalagang tulay na nag-uugnay sa kusina at mga customer. Bawat ngiti, bawat on-time na paghahatid ay lumilikha ng magandang karanasan sa pagkain.

Tandaan:
- ✨ **Ang ugali ay lahat** - Manatiling positibo at masigasig
- 🚀 **Ang efficiency ay lumilikha ng halaga** - Mabilis pero matatag
- 🤝 **Ang serbisyo ay mula sa puso** - Tratuhin ang bawat customer nang taos-puso
- 📈 **Patuloy na pagpapahusay** - Maging mas mahusay kaysa kahapon

Nawa'y magtagumpay ka at maging pinakamahusay na service crew!

---

<div align="center">

**Gabay sa Paggamit ng MakanMakan para sa Service Crew**

Ginagawang magandang karanasan ang bawat serbisyo

**Bersyon 2.0** | **2025-10-26**

</div>
