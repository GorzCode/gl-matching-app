# 🧠 Matching Algorithm Reference

## Overview

The GL Matching application uses a **6-pass intelligent matching algorithm** to reconcile bank transactions with QuickBooks General Ledger entries.

## Architecture

```
Bank Transaction (CSV)  ←→  QuickBooks Transaction (Excel)
       ↓                              ↓
    Deposit                        Debit
    Withdrawal                     Credit
       ↓                              ↓
    6-Pass Matcher  →  Matched Pairs + Unmatched
```

## The 6 Matching Passes

### Pass 1: Exact Match ⚡
**Criteria:**
- Same date (exact day match)
- Same amount
- Deposit → Debit, Withdrawal → Credit

**Example:**
```
Bank:  01/15/2025, Deposit, $5,000.00
QB:    01/15/2025, Debit, $5,000.00
→ MATCH ✓
```

**Typical match rate:** 60-70% of transactions

---

### Pass 2: Near Date ±3 Days 📅
**Criteria:**
- Amount matches exactly
- Date within 3 days (before or after)
- Type compatible

**Example:**
```
Bank:  01/15/2025, Withdrawal, $1,500.00
QB:    01/17/2025, Credit, $1,500.00
→ MATCH ✓ (2 days difference)
```

**Why:** Captures processing delays, weekends, holidays

**Typical match rate:** 15-20% additional

---

### Pass 3: Near Date ±7 Days 📆
**Criteria:**
- Amount matches exactly
- Date within 7 days
- Type compatible

**Example:**
```
Bank:  01/10/2025, Deposit, $3,000.00
QB:    01/16/2025, Debit, $3,000.00
→ MATCH ✓ (6 days difference)
```

**Why:** Catches wire transfers, check clearing delays

**Typical match rate:** 3-5% additional

---

### Pass 4: Transaction Splits 🔀
**Criteria:**
- 2-3 QB transactions sum to 1 bank transaction
- Same date (all QB entries must be on same date)
- Within ±5 days of bank transaction
- Sum matches within $0.01

**Example:**
```
Bank:  01/20/2025, Withdrawal, $10,000.00

QB:    01/20/2025, Credit, $6,000.00  (Vendor A)
QB:    01/20/2025, Credit, $4,000.00  (Vendor B)
→ SPLIT MATCH ✓ (2 transactions)
```

**Why:** Single bank transaction may represent multiple QB entries

**Algorithm:**
```typescript
for each unmatched bank transaction:
  find QB candidates on same date
  try all combinations of 2 entries
  try all combinations of 3 entries
  if sum matches (±$0.01), mark as split match
```

**Typical match rate:** 1-2% of transactions

---

### Pass 5: Fuzzy Amount ±$1 💰
**Criteria:**
- Date within ±3 days
- Amount within ±$1.00 (for rounding differences)
- Type compatible

**Example:**
```
Bank:  02/05/2025, Deposit, $1,234.56
QB:    02/06/2025, Debit, $1,235.00
→ MATCH ✓ (difference: $0.44)
```

**Why:** Rounding, fees, currency conversion

**Typical match rate:** 0-1% of transactions

---

### Pass 6: Vendor + Type Compatible 🏢
**Criteria:**
- Date within ±3 days
- Exact amount match
- Type compatible (Deposit/Debit or Withdrawal/Credit)
- Vendor name similarity > 60%

**Vendor Normalization:**
```typescript
// Maps common variations to standard names
'CITI CARD ONLINE' → 'CITI CARD'
'BK OF AMER VISA' → 'BANK OF AMERICA'
'SBA EIDL LOAN' → 'SBA'

// Removes prefixes
'ZELLE PAYMENT TO John' → 'JOHN'
'ORIG CO NAME: ABC Corp' → 'ABC'
```

**Similarity Scoring:**
- Uses Levenshtein distance
- 60%+ similarity threshold
- Exact normalized match = auto-accept

**Example:**
```
Bank:  03/10/2025, Withdrawal, $500.00, "Zelle Payment To John Smith"
QB:    03/11/2025, Check, $500.00, "John Smith"

Normalized:
  Bank vendor: "JOHN"
  QB name: "JOHN"
  Similarity: 100%
→ MATCH ✓
```

**Typical match rate:** 2-5% of transactions

---

## Type Compatibility Matrix

| Bank Type | Compatible QB Types |
|-----------|-------------------|
| **Deposit** | Deposit, Payment, Sales Receipt, Invoice Payment |
| **Withdrawal** | Check, Bill Pmt -Check, Transfer, Expense, Credit Card |

---

## Match Rate Expectations

### Excellent (95%+)
- Clean data
- Consistent date formats
- Accurate vendor names
- Regular reconciliation

### Good (90-95%)
- Some timing differences
- Minor vendor name variations
- Occasional splits

### Needs Review (80-90%)
- Large timing gaps
- Significant vendor mismatches
- Many manual entries
- Missing transactions

### Action Required (<80%)
- Data quality issues
- Wrong file format
- Incorrect date parsing
- Missing required columns

---

## Common Unmatched Scenarios

### Bank but not QB
- **Service fees** - Excluded by filter
- **Personal transactions** - Not recorded in QB
- **Timing** - Future QB entry
- **Deposits in transit**

### QB but not Bank
- **Checks not cashed yet**
- **Pending transfers**
- **Different account** - QB has multiple accounts
- **Manual adjustments**

---

## Optimization Tips

### Improve Match Rate

1. **Consistent Vendor Names**
   - Use same spelling in bank and QB
   - Add mappings to `normalizeVendor()`

2. **Date Alignment**
   - Record transactions on same day when possible
   - Use transaction date, not posting date

3. **Regular Reconciliation**
   - Match monthly vs. annually
   - Smaller gaps = higher accuracy

4. **Clean Data**
   - Remove duplicates
   - Fix date formats before import
   - Standardize amount formatting

### Performance

Current performance on typical datasets:
- **1,000 transactions:** ~2-3 seconds
- **5,000 transactions:** ~10-15 seconds
- **10,000+ transactions:** ~30-60 seconds

Bottleneck: Split matching (combinatorial complexity)

---

## Algorithm Complexity

| Pass | Time Complexity | Notes |
|------|----------------|-------|
| Pass 1-3 | O(n × m) | n=bank, m=QB, filtered candidates |
| Pass 4 | O(n × m²) | Worst case: checking combinations |
| Pass 5-6 | O(n × m) | Similar to Pass 1-3 |

**Overall:** O(n × m²) dominated by split matching

**Optimization:** Early exit when match found, candidate filtering

---

## Debugging Tips

### Low Match Rate

1. **Check date parsing:**
   - Run in dev mode
   - Review console logs
   - Verify dates are valid

2. **Verify amounts:**
   - Check for thousands separator (commas)
   - Ensure proper decimal places
   - Look for currency symbols

3. **Review vendor names:**
   - Compare bank vs. QB vendor spellings
   - Add custom mappings
   - Check for special characters

### False Matches

1. **Too broad tolerance:**
   - Reduce date windows
   - Lower fuzzy amount tolerance
   - Increase vendor similarity threshold

2. **Multiple candidates:**
   - Algorithm only matches 1:1
   - If ambiguous, leaves unmatched
   - Review manually

### Split Detection Missing

1. **Date spread too wide:**
   - Check if QB entries are on same date
   - Ensure within ±5 days of bank

2. **Amount precision:**
   - Verify cents match exactly
   - Check for rounding issues

---

## Customization Examples

### Increase Date Window
```typescript
// src/main/matcher.ts - Line 79
const pass2 = this.nearDateMatch(5);  // was 3
```

### Add Vendor Mapping
```typescript
// src/main/matcher.ts - normalizeVendor()
const mappings: { [key: string]: string[] } = {
  'YOUR BANK': ['BANK NAME VARIANT 1', 'BANK NAME VARIANT 2'],
  // ...
};
```

### Change Fuzzy Tolerance
```typescript
// src/main/matcher.ts - Line 233
Math.abs(this.getQBAmount(qb, bank.type) - bankAmount) <= 2.0  // was 1.0
```

### Disable a Pass
```typescript
// src/main/matcher.ts - match()
// const pass5 = this.fuzzyAmountMatch();  // Comment out
const pass5 = 0;  // Set to 0
```

---

## Output Details

### Matched Transactions CSV
```csv
Match_Type,Bank_Date,QB_Date,Amount,Bank_Type,Bank_Vendor,QB_Name,...
"Exact","01/15/2025","01/15/2025",5000.00,"Deposit","ABC Corp","ABC Corp",...
"Near Date (±3d)","01/20/2025","01/22/2025",1500.00,"Withdrawal",...
"Split (2 transactions)","02/10/2025","02/10/2025",10000.00,...
```

### Match Types in Report
- `Exact` - Pass 1
- `Near Date (±3d)` - Pass 2
- `Near Date (±7d)` - Pass 3
- `Split (2 transactions)` - Pass 4 (2 QB → 1 Bank)
- `Split (3 transactions)` - Pass 4 (3 QB → 1 Bank)
- `Fuzzy Amount` - Pass 5
- `Vendor+Type (XX% similar)` - Pass 6

---

## Algorithm Flow Chart

```
Start
  ↓
Load Bank CSV → Parse dates/amounts → Filter fees
  ↓
Load QB Excel → Parse dates/amounts → Filter account/year
  ↓
Pass 1: Exact Match
  ↓ (mark matched)
Pass 2: ±3 Days
  ↓ (mark matched)
Pass 3: ±7 Days
  ↓ (mark matched)
Pass 4: Splits
  ↓ (mark matched)
Pass 5: Fuzzy Amount
  ↓ (mark matched)
Pass 6: Vendor Match
  ↓ (mark matched)
Collect Unmatched
  ↓
Export Results (3 CSVs + 1 TXT)
  ↓
End
```

---

**For more details, see the source code in `src/main/matcher.ts`**
