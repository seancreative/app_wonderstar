# Fiuu Payment Return URL Configuration

## Issue

After successful payment on Fiuu gateway, users are being redirected to:
```
http://localhost/api/payments/return
```

This should instead redirect to your React app's payment callback page:
```
https://your-app-domain.com/payment/callback?order_id={orderId}&status={status}
```

## Solution

You need to update the **return URL** configuration in your **Laravel backend** (`https://app.wonderpark.my`).

### Backend Changes Required

In your Laravel API, when you initiate payment with Fiuu, you need to set the correct return URL. This is typically in your payment controller or service.

#### Example Fix in Laravel:

```php
// In your payment initiation code (e.g., PaymentController.php)

public function initiatePayment(Request $request)
{
    // ... your existing code ...

    $returnUrl = env('FRONTEND_URL') . '/myqr';

    // When preparing Fiuu payment data
    $fiuuPaymentData = [
        // ... other payment data ...
        'return_url' => $returnUrl,  // Add this
        'callback_url' => env('APP_URL') . '/api/payments/callback',  // Backend callback for processing
    ];

    // ... rest of your code ...
}
```

#### Add to your .env file:

```env
FRONTEND_URL=https://your-app-domain.com
# or for local development:
FRONTEND_URL=http://localhost:5173
```

### Frontend Callback Route

Your React app is already configured with the callback route at:
```
/payment/callback
```

This page handles:
- ✅ Verifying payment status
- ✅ Updating order status
- ✅ Showing success/failure messages
- ✅ Redirecting to appropriate pages
- ✅ Reloading wallet balance (if applicable)

### Query Parameters Expected

The frontend callback page expects these URL parameters:
- `order_id` - The order ID from payment transaction
- `status` (optional) - Payment status (success/failed/cancelled)
- `outlet` (optional) - For shop orders, the outlet slug for proper redirect

Example:
```
https://your-app.com/payment/callback?order_id=ORD-1234567890&status=success&outlet=wonderpark-branch-1
```

### Testing Locally

For local development, use:
```
FRONTEND_URL=http://localhost:5173
```

Then the return URL will be:
```
http://localhost:5173/payment/callback?order_id={orderId}
```

## What Happens After Return

1. User completes payment on Fiuu gateway
2. Fiuu redirects to: `{FRONTEND_URL}/payment/callback?order_id={orderId}`
3. Frontend shows loading screen
4. Frontend calls backend API to get transaction status
5. Frontend updates local order status
6. Frontend shows success/failure message
7. Frontend redirects to:
   - Shop order success page (for shop orders)
   - Wallet page (for wallet topups)
   - Home page (as fallback)

## Important Notes

- **Return URL** = Where user is redirected in browser (frontend)
- **Callback URL** = Where Fiuu POSTs payment result (backend)
- Both URLs can be different and serve different purposes
- Always use HTTPS in production for security
- Test thoroughly with both success and failure scenarios
