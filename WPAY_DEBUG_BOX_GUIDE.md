# WPay Debug Box - User Guide

A collapsible floating debug panel that tracks all WPay API interactions in real-time for debugging purposes.

## Features

### 🎯 Real-Time API Tracking
- Captures all requests sent to WPay backend
- Records all responses received from WPay API
- Logs errors with full details
- Tracks request duration (in milliseconds)

### 📊 Detailed Information Display

Each log entry shows:

**Request Data:**
- Email
- Payment category (topup/checkout)
- Payment type (online/wbalance/free)
- Order ID
- Amount
- Metadata (collapsible)

**Response Data:**
- Status (success/pending/failed)
- Transaction ID
- Order ID
- Profile information:
  - W-Balance
  - Bonus balance
  - Stars
  - Tier type & factor
  - Lifetime topups
- Transaction details:
  - Amount processed
  - W-Balance used
  - Bonus used
  - Stars awarded
- Error messages (if any)

### 🎨 Visual Features
- Color-coded status indicators:
  - 🟢 Green: Success
  - 🟡 Yellow: Pending
  - 🔴 Red: Failed/Error
  - 🔵 Blue: Request
- Expandable/collapsible log entries
- Copy to clipboard functionality
- Auto-scrolling log history (keeps last 50 entries)
- Timestamp for each entry (HH:mm:ss.SSS format)

## How to Use

### 1. Opening the Debug Panel

Look for the **purple bug icon** button in the top-right corner of the screen:

```
[🐛]  ← Click this to open
```

If there are logged API calls, you'll see a red badge showing the count.

### 2. Viewing Logs

Once opened, you'll see a panel on the right side showing all WPay API interactions:

```
┌─────────────────────────────────────┐
│ 🐛 WPay Debug          [50 logs] 🗑️ │
├─────────────────────────────────────┤
│                                     │
│  ► POST 14:25:30.123               │
│    /wpay/process                   │
│    250ms                           │
│                                     │
│  ► GET 14:25:15.456                │
│    /wpay/profile/user@email.com    │
│    150ms                           │
│                                     │
└─────────────────────────────────────┘
```

### 3. Expanding Log Details

Click on any log entry to expand and see full details:

```
▼ POST 14:25:30.123
  /wpay/process
  250ms

  REQUEST                        [📋]
  ┌─────────────────────────────────┐
  │ email: user@example.com         │
  │ category: checkout              │
  │ type: wbalance                  │
  │ order_id: WP12345678           │
  │ amount: RM 50.00               │
  │ ▶ metadata                      │
  └─────────────────────────────────┘

  RESPONSE                       [📋]
  ┌─────────────────────────────────┐
  │ status: success                 │
  │ transaction_id: TXN123456      │
  │ order_id: WP12345678           │
  │ ▶ Profile                       │
  │   • wbalance: RM 150.00        │
  │   • bonus: RM 25.00            │
  │   • stars: 2500                │
  │   • tier: gold                 │
  │ ▶ Transaction Details           │
  │   • wbalance_used: RM 30.00    │
  │   • bonus_used: RM 20.00       │
  │   • stars_awarded: 125         │
  └─────────────────────────────────┘
```

### 4. Copying Data

Each request/response section has a **copy button** (📋):
- Click to copy the entire JSON to clipboard
- Button shows ✅ checkmark when copied
- Useful for sharing with backend developers

### 5. Clearing Logs

Click the **trash icon** (🗑️) in the header to clear all logs.

### 6. Closing the Panel

Click the **X button** in the top-right to close the panel.
The bug icon button will remain visible for quick access.

## Debug Mode Settings

### Enable/Disable Debug Mode

**Default:** Automatically enabled in development mode

**Manual Control:**
- Open the debug panel
- At the bottom, you'll see: "Debug Mode: ON"
- Click "Disable" to turn off logging
- Logs will stop being captured
- Previously captured logs will be cleared

**Persistence:**
- Your preference is saved to localStorage
- Setting persists across page reloads

### Re-enabling Debug Mode

To re-enable after disabling:
1. Open browser console
2. Type: `localStorage.setItem('wpay_debug_enabled', 'true')`
3. Refresh the page
4. Debug panel will reappear

## Use Cases

### 1. Testing Payment Flow

**Scenario:** Verify payment processing

Steps:
1. Open debug panel
2. Clear existing logs
3. Make a purchase in the app
4. Check debug panel for:
   - Request sent with correct amount
   - Response shows `wpay_status: success`
   - `stars_awarded` value is correct
   - Balance deductions match expectations

### 2. Debugging Failed Payments

**Scenario:** Payment fails and you need details

Steps:
1. Open debug panel after failed payment
2. Look for red status indicator
3. Expand the failed log entry
4. Check ERROR section for:
   - Error message from backend
   - Request data that was sent
   - Response data (if any)
5. Copy the entire log to share with backend team

### 3. Verifying Balance Updates

**Scenario:** Check if profile is synced correctly

Steps:
1. Open debug panel
2. Navigate to Profile page (triggers `/wpay/profile` call)
3. Expand the profile response
4. Verify:
   - W-Balance matches UI display
   - Bonus balance is correct
   - Stars count is accurate
   - Tier type is correct

### 4. Monitoring API Performance

**Scenario:** Check if API is slow

Steps:
1. Open debug panel
2. Make several transactions
3. Look at the duration (ms) for each call
4. Identify slow endpoints:
   - Normal: < 500ms
   - Slow: 500ms - 2000ms
   - Very slow: > 2000ms
   - Timeout: 30000ms (30s)

## Tips & Best Practices

### For Developers

1. **Keep It Open During Development**
   - Leave the panel open while testing payment flows
   - Quickly spot API issues without checking console

2. **Use Metadata for Context**
   - All payments include metadata field
   - Contains outlet_id, items_count, voucher info, etc.
   - Helps correlate frontend and backend logs

3. **Check Request Before Response**
   - Verify request data is correct before blaming backend
   - Common issues: wrong amount, missing email, incorrect payment_type

4. **Copy Logs for Bug Reports**
   - Use copy button to grab full JSON
   - Include in bug reports or GitHub issues
   - Makes debugging much faster

### For QA/Testers

1. **Document Test Flows**
   - Screenshot the debug panel showing successful flow
   - Include in test reports

2. **Reproduce Bugs Reliably**
   - Clear logs before reproducing a bug
   - Copy the exact request that caused the issue
   - Share with developers

3. **Verify Edge Cases**
   - Test with RM 0.00 (free orders)
   - Test with bonus usage
   - Test with insufficient balance
   - Check error messages make sense

## Technical Details

### Log Storage
- Stored in React state (not persisted)
- Maximum 50 entries (oldest removed)
- Cleared on page refresh
- Cleared when debug mode disabled

### Security Notes
- ⚠️ Contains sensitive user data (email, balances, transaction IDs)
- Only shows in development mode by default
- Can be manually enabled in production (use with caution)
- Never share screenshots publicly without redacting user data

### Performance Impact
- Minimal overhead (~1-2ms per API call)
- Logs stored in memory only
- No database or localStorage writes (except preference)
- Safe to leave enabled during development

## Troubleshooting

### Debug Panel Not Showing

**Solution 1:** Check if debug mode is enabled
```javascript
// In browser console:
localStorage.getItem('wpay_debug_enabled')
// Should return "true"
```

**Solution 2:** Enable it manually
```javascript
localStorage.setItem('wpay_debug_enabled', 'true')
location.reload()
```

### No Logs Appearing

**Possible causes:**
1. No WPay API calls made yet (try navigating to Profile page)
2. Debug mode disabled (check localStorage)
3. WPay service not loaded (check console for errors)

**Solution:** Trigger an API call
- Go to Profile page → triggers `/wpay/profile`
- Go to checkout → triggers `/wpay/process`

### Logs Not Expanding

**Solution:** Click directly on the log entry (not the chevron icon)

### Copy Button Not Working

**Possible causes:**
1. Browser clipboard permission denied
2. HTTPS required for clipboard API

**Solution:**
- Check browser console for permission errors
- Ensure site is running on HTTPS or localhost

## Examples

### Example 1: Successful W-Balance Payment

```json
REQUEST:
{
  "email": "john@example.com",
  "payment_category": "checkout",
  "payment_type": "wbalance",
  "order_id": "WP12345678",
  "amount": 50.00,
  "customer_name": "John Doe",
  "customer_phone": "+60123456789",
  "product_name": "Shop order WP12345678 - 3 item(s)",
  "metadata": {
    "outlet_id": "outlet-123",
    "outlet_name": "Main Store",
    "items_count": 3,
    "use_bonus": 10.00
  }
}

RESPONSE:
{
  "wpay_status": "success",
  "transaction_id": "TXN789012",
  "order_id": "WP12345678",
  "profile": {
    "email": "john@example.com",
    "wbalance": 150.00,
    "bonus": 15.00,
    "stars": 3250,
    "tier_type": "gold",
    "tier_factor": 1.5
  },
  "transaction_details": {
    "amount": 50.00,
    "wbalance_used": 40.00,
    "bonus_used": 10.00,
    "stars_awarded": 125
  }
}
```

### Example 2: Free Order with Voucher

```json
REQUEST:
{
  "email": "jane@example.com",
  "payment_category": "checkout",
  "payment_type": "free",
  "order_id": "WP87654321",
  "amount": 25.00,
  "metadata": {
    "voucher_code": "FREECOFFEE",
    "voucher_discount": 25.00,
    "is_free_order": true,
    "use_bonus": 0
  }
}

RESPONSE:
{
  "wpay_status": "success",
  "transaction_id": "TXN456789",
  "order_id": "WP87654321",
  "transaction_details": {
    "amount": 25.00,
    "wbalance_used": 0,
    "bonus_used": 0,
    "stars_awarded": 0
  }
}
```

### Example 3: Failed Payment (Insufficient Balance)

```json
REQUEST:
{
  "email": "user@example.com",
  "payment_category": "checkout",
  "payment_type": "wbalance",
  "order_id": "WP11111111",
  "amount": 100.00
}

RESPONSE:
{
  "wpay_status": "failed",
  "message": "Insufficient balance. Available: RM 50.00, Required: RM 100.00"
}

ERROR:
"WPay Error: Insufficient balance. Available: RM 50.00, Required: RM 100.00"
```

## Keyboard Shortcuts

Currently none implemented, but potential additions:
- `Ctrl+Shift+D` - Toggle debug panel
- `Ctrl+K` - Clear logs
- `Escape` - Close panel

---

**Questions or Issues?**
Check the browser console for detailed error messages if the debug panel isn't working as expected.
