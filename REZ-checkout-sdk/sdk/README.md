# ReZ Checkout Embeddable SDK

Embed the ReZ one-click checkout into your website or mobile app.

## Quick Start

### 1. Include the SDK

```html
<!-- Add to your HTML head -->
<script src="https://cdn.rez.in/sdk/checkout@latest.js"></script>
```

Or install via npm:

```bash
npm install @rez/checkout-sdk-web
```

### 2. Initialize the SDK

```javascript
const rezCheckout = ReZCheckout.init({
  apiKey: 'your_api_key',
  merchantId: 'your_merchant_id',
  environment: 'production', // or 'sandbox'
  onSuccess: (order) => {
    console.log('Order placed:', order.orderId);
  },
  onError: (error) => {
    console.error('Checkout failed:', error);
  }
});
```

### 3. Launch Checkout

#### Standard Checkout

```javascript
// Open checkout modal with cart
rezCheckout.open({
  sessionId: 'user_session_id', // optional
  items: [
    {
      productId: 'prod_123',
      name: 'Product Name',
      price: 999,
      quantity: 1,
      imageUrl: 'https://example.com/product.jpg'
    }
  ]
});
```

#### Quick Buy (Single Item)

```javascript
rezCheckout.quickBuy({
  productId: 'prod_123',
  name: 'Product Name',
  price: 999,
  quantity: 1
});
```

#### Reorder

```javascript
rezCheckout.reorder({
  orderId: 'ORD-ABC123'
});
```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | string | Yes | Your ReZ API key |
| `merchantId` | string | Yes | Your merchant ID |
| `environment` | string | No | 'sandbox' or 'production' |
| `theme` | object | No | Custom theme colors |
| `locale` | string | No | Language (en, hi) |
| `currency` | string | No | Currency code (INR default) |

## Theme Customization

```javascript
rezCheckout.configure({
  theme: {
    primaryColor: '#FF5722',
    secondaryColor: '#FFC107',
    fontFamily: 'Roboto, sans-serif',
    borderRadius: '8px'
  }
});
```

## Events

### Event Callbacks

```javascript
const rezCheckout = ReZCheckout.init({
  apiKey: 'your_api_key',
  merchantId: 'your_merchant_id',

  // Called when checkout completes successfully
  onSuccess: (order) => {
    // order.orderId - Order ID
    // order.status - Order status
    // order.total - Total amount
    // order.paymentMethod - Payment method used
    showOrderConfirmation(order);
  },

  // Called when checkout fails
  onError: (error) => {
    // error.code - Error code
    // error.message - Error message
    showErrorMessage(error);
  },

  // Called when checkout is closed without completing
  onClose: () => {
    console.log('Checkout modal closed');
  },

  // Called when address is selected/entered
  onAddressChange: (address) => {
    updateShippingEstimate(address);
  },

  // Called when payment method changes
  onPaymentMethodChange: (method) => {
    updatePaymentOptions(method);
  },

  // Called when order amount changes (after discount, shipping, etc.)
  onTotalChange: (total) => {
    updateOrderTotal(total);
  }
});
```

## API Methods

### `ReZCheckout.init(config)`

Initialize the SDK. Call once on page load.

```javascript
const sdk = ReZCheckout.init({
  apiKey: 'pk_live_xxxxx',
  merchantId: 'merchant_123',
  environment: 'production'
});
```

### `sdk.open(options)`

Open the checkout modal.

```javascript
sdk.open({
  sessionId: 'session_xxx',     // Optional: for existing cart
  items: [...],                  // Cart items
  prefill: {                    // Optional: prefill user data
    email: 'user@example.com',
    phone: '+919876543210',
    name: 'John Doe'
  },
  shippingAddress: {            // Optional: pre-selected address
    id: 'addr_123'
  },
  paymentMethod: 'UPI'          // Optional: pre-selected payment
});
```

### `sdk.quickBuy(item)`

Open checkout for a single item.

```javascript
sdk.quickBuy({
  productId: 'prod_123',
  name: 'Premium Widget',
  price: 1999,
  quantity: 1,
  imageUrl: 'https://cdn.example.com/widget.jpg',
  sku: 'WDG-001'
});
```

### `sdk.reorder(orderId)`

Open checkout with items from a previous order.

```javascript
sdk.reorder('ORD-ABC123-DEF456');
```

### `sdk.updateCart(items)`

Update the cart contents.

```javascript
sdk.updateCart([
  {
    productId: 'prod_123',
    name: 'Updated Name',
    price: 1099,
    quantity: 2
  }
]);
```

### `sdk.applyCoupon(code)`

Apply a coupon code.

```javascript
sdk.applyCoupon('SAVE20').then(result => {
  if (result.success) {
    console.log('Discount applied:', result.discount);
  }
});
```

### `sdk.selectAddress(addressId)`

Select a saved address.

```javascript
sdk.selectAddress('addr_456');
```

### `sdk.selectPaymentMethod(method)`

Select a payment method.

```javascript
sdk.selectPaymentMethod('UPI');
```

### `sdk.getOrderStatus(orderId)`

Get the status of an order.

```javascript
sdk.getOrderStatus('ORD-ABC123-DEF456').then(status => {
  console.log('Order status:', status);
});
```

### `sdk.close()`

Close the checkout modal.

```javascript
sdk.close();
```

### `sdk.destroy()`

Clean up and destroy the SDK instance.

```javascript
sdk.destroy();
```

## React Integration

```jsx
import { ReZCheckoutProvider, useReZCheckout } from '@rez/checkout-sdk-react';

function App() {
  return (
    <ReZCheckoutProvider
      apiKey="your_api_key"
      merchantId="your_merchant_id"
      onSuccess={(order) => handleSuccess(order)}
      onError={(error) => handleError(error)}
    >
      <CheckoutButton />
      <ProductPage />
    </ReZCheckoutProvider>
  );
}

function CheckoutButton() {
  const { open, quickBuy } = useReZCheckout();

  return (
    <button onClick={() => open({ items: cartItems })}>
      Checkout
    </button>
  );
}
```

## React Native Integration

```javascript
import ReZCheckout from '@rez/checkout-sdk-react-native';

const rezCheckout = new ReZCheckout({
  apiKey: 'your_api_key',
  merchantId: 'your_merchant_id',
  onSuccess: (order) => navigation.navigate('OrderConfirmation', { order }),
  onError: (error) => showAlert('Error', error.message)
});

// In your component
<Button
  title="Buy Now"
  onPress={() => razCheckout.quickBuy({
    productId: 'prod_123',
    name: 'Product',
    price: 999,
    quantity: 1
  })}
/>
```

## Widget Modes

### Full Page

```javascript
ReZCheckout.init({
  // ... other config
  mode: 'fullpage',
  container: '#checkout-container'
});
```

### Modal (Default)

```javascript
ReZCheckout.init({
  mode: 'modal',
  modalConfig: {
    width: '480px',
    height: 'auto',
    maxHeight: '90vh'
  }
});
```

### Side Drawer

```javascript
ReZCheckout.init({
  mode: 'drawer',
  drawerConfig: {
    position: 'right',
    width: '400px'
  }
});
```

## Address Autocomplete

The SDK includes built-in address autocomplete for Indian addresses.

```javascript
ReZCheckout.init({
  apiKey: 'your_api_key',
  merchantId: 'your_merchant_id',
  features: {
    addressAutocomplete: true,
    pinCodeLookup: true
  }
});
```

## Error Codes

| Code | Description |
|------|-------------|
| `CART_EMPTY` | Cart has no items |
| `INVALID_ADDRESS` | Address validation failed |
| `PAYMENT_FAILED` | Payment processing failed |
| `FRAUD_SUSPECTED` | Order flagged for fraud review |
| `ITEM_UNAVAILABLE` | Product no longer available |
| `SESSION_EXPIRED` | Checkout session expired |
| `NETWORK_ERROR` | Network connectivity issue |
| `USER_CANCELLED` | User closed checkout without completing |

## Security

- All communication is over HTTPS
- Payment details are never stored on your servers
- PCI DSS compliant payment handling
- Session tokens are JWT-based with 7-day expiration
- Rate limiting on all endpoints

## Support

- Documentation: https://docs.rez.in/checkout
- Support Email: support@rez.in
- Developer Portal: https://developers.rez.in
