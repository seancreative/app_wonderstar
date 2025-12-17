# Fiuu Payment Integration - Testing Guide

## Payment Flow

### For Shop Checkout with Fiuu Payment Methods

1. **Add items to cart** from any outlet
2. **Navigate to checkout** page
3. **Select a payment method** (Credit/Debit Card, FPX, GrabPay, TnG, or Boost)
4. **Click "Pay Now"**

#### First Time User (No Address):
- Address form modal will appear
- Fill in:
  - Street Address
  - City
  - Postcode (5 digits)
  - State (dropdown)
- Click "Continue to Payment"
- System saves address to user profile
- Reloads user data
- After 500ms delay, continues with payment processing

#### Returning User (Has Address):
- Skips address form
- Proceeds directly to payment processing

### Payment Processing Steps

1. **Create/Retrieve Fiuu Customer**
   - Checks if user already has Fiuu customer record
   - If not, creates new customer via Fiuu API using saved address

2. **Create Order**
   - Creates shop order with status 'pending'
   - Links to payment transaction

3. **Create Payment Transaction**
   - Generates unique order ID (ORD-timestamp)
   - Records payment intent in database
   - Stores order metadata

4. **Initiate Fiuu Payment**
   - Fetches available products from Fiuu API
   - Maps payment method to Fiuu format:
     - card/credit → 'credit'
     - debit → 'debit'
     - fpx/grabpay/tng/boost → 'ewallet'
   - Calls Fiuu initiate payment API
   - Receives payment URL and form data

5. **Redirect to Fiuu**
   - Auto-submits hidden form
   - User redirected to Fiuu payment page
   - User completes payment on Fiuu

6. **Return via Callback**
   - User returns to /payment/callback
   - System polls Fiuu API for transaction status
   - Updates order status based on result
   - Awards stars and stamps on success
   - Redirects to appropriate page

## Database Tables

### fiuu_customers
Stores mapping between WonderStars users and Fiuu customer IDs

### payment_transactions
Tracks all Fiuu payment attempts with:
- Status (pending/processing/success/failed/cancelled)
- Fiuu transaction details
- Links to shop orders or wallet transactions

### Updated Tables

#### users
New address fields:
- address
- city
- state
- postcode
- country (default 'MY')

#### shop_orders
New field:
- payment_transaction_id (links to payment_transactions)

#### wallet_transactions
New field:
- payment_transaction_id (links to payment_transactions)

## Testing the Flow

### Test Scenario 1: First Time Payment
1. Create new user account
2. Add products to cart
3. Go to checkout
4. Select "Credit/Debit Card"
5. Click "Pay Now"
6. **Expected**: Address form appears
7. Fill in address details
8. Click "Continue to Payment"
9. **Expected**: Processing indicator, then redirect to Fiuu

### Test Scenario 2: Returning User Payment
1. Login as user with saved address
2. Add products to cart
3. Go to checkout
4. Select "GrabPay"
5. Click "Pay Now"
6. **Expected**: Direct processing, no address form

### Test Scenario 3: Address Validation
1. Try to submit address form with:
   - Empty fields → Should show validation errors
   - Invalid postcode (not 5 digits) → Should show error
   - Valid data → Should proceed

### Error Scenarios

#### Network Error
- Fiuu API unreachable
- Shows error modal with retry option

#### Payment Creation Failed
- Database error
- Shows error with details

#### Payment Cancelled
- User cancels on Fiuu page
- Returns to callback with cancelled status
- Order remains in database with 'pending' status

## API Endpoints Used

### GET /products
Fetches available Fiuu products

### POST /customers
Creates new Fiuu customer with address

### POST /payments/initiate
Initiates payment transaction
Returns payment_url and payment_data for form submission

### GET /payments/transaction/{orderId}
Checks payment transaction status

## Debugging Tips

1. **Check Browser Console**
   - Look for "Error processing Fiuu payment:" messages
   - Check network tab for API call failures

2. **Check Database**
   - payment_transactions table for transaction status
   - fiuu_customers table for customer creation
   - users table for address data

3. **Common Issues**
   - Address not saved: Check user reload after address submission
   - Payment not initiating: Check Fiuu API connection
   - Callback not working: Verify /payment/callback route exists

## Next Steps

- Test with real Fiuu credentials when available
- Implement webhook handler for server-side payment verification
- Add payment history view for users
- Implement refund handling
