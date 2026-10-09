# Shafaq Platform Integration Guide (SRS v1.2)

This guide provides frontend and mobile developers with comprehensive instructions for integrating with the Shafaq Pharmacy & Consultation backend server.

---

## 1. Authentication & Identity Flow

1. **Request OTP:**
   - `POST /api/v1/auth/otp/request`
   - Body: `{ "phone": "+963991234567" }`
2. **Verify OTP & Login:**
   - `POST /api/v1/auth/otp/verify`
   - Body: `{ "phone": "+963991234567", "code": "123456" }`
   - Response: Returns authentication token (`token`) and session type (`CUSTOMER` or `INTERNAL`).
3. **Get Current User Profile:**
   - `GET /api/v1/me`
   - Headers: `Authorization: Bearer <token>`, `x-user-id: <userId>`
4. **Logout / Revoke Session:**
   - `POST /api/v1/auth/logout`

---

## 2. Order & Prescription Flow

1. **Upload Prescription (Optional / Required for Rx orders):**
   - `POST /api/v1/prescriptions/upload`
   - Form-Data: `file` (image/pdf)
2. **Create Order:**
   - `POST /api/v1/orders`
   - Body: `{ "pharmacyId": "...", "deliveryAddress": "...", "deliveryLatitude": 33.51, "deliveryLongitude": 36.27, "items": [...] }`
3. **Pharmacy Quotation:**
   - Owners/Pharmacists review the order and submit an itemized price quote.
4. **Customer Confirmation & Payment:**
   - Customer reviews quote and initiates payment via Sham Cash (`POST /payments/pay`).

---

## 3. Delivery & Driver Offers Flow

1. **Driver Search & Offers:**
   - When order is ready for pickup, pharmacy triggers driver search (`POST /deliveries/orders/:id/start-search`).
   - Drivers list pending offers (`GET /driver/offers/pending`) and accept atomically (`POST /driver/offers/:id/accept`).
2. **GPS Tracking:**
   - Drivers periodically update GPS location (`POST /driver/tracking/location`).
3. **Delivery Completion & OTP:**
   - Driver verifies customer delivery OTP (`POST /driver/deliveries/:id/verify-otp`) and records cash collection.

---

## 4. Consultations & Private Chat

1. **Create Consultation:**
   - `POST /api/v1/consultations` (Enforces one active consultation per customer).
2. **Assign Pharmacist:**
   - Pharmacy owner assigns an active pharmacist (`POST /api/v1/consultations/:id/assign`).
3. **Private Chat:**
   - Send and receive messages (`GET /api/v1/consultations/:id/messages`, `POST /api/v1/consultations/:id/messages`). Strict authorization restricts access to customer and assigned pharmacist only.

---

## 5. API Documentation & Health

- **Interactive Swagger UI:** `http://localhost:3000/api/docs`
- **Health Check Endpoint:** `GET /api/v1/health`
