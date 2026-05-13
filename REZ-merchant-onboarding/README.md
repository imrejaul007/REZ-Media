# ReZ Merchant Onboarding Service

A comprehensive merchant signup, KYC verification, and approval workflow service for the ReZ commerce platform.

## Features

- **Multi-step Registration**: Step-by-step merchant onboarding process
- **Email Verification**: Secure email verification with token-based authentication
- **KYC Document Management**: Upload and manage KYC documents
  - PAN Card
  - GST Certificate
  - Bank Account Proof
  - Address Proof
  - Business Address Proof
- **Business Verification**: Business details validation and verification
- **Admin Approval Workflow**: Complete admin dashboard for reviewing applications
- **Email Notifications**: Automated email notifications for all stages
- **Status Tracking**: Real-time status tracking throughout the onboarding process

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Validation**: Zod
- **Authentication**: JWT (JSON Web Tokens)
- **File Uploads**: Multer
- **Email**: Nodemailer
- **Logging**: Winston

## Prerequisites

- Node.js 18+
- MongoDB 6+
- npm or yarn

## Installation

```bash
# Clone the repository
cd REZ-Media/REZ-merchant-onboarding

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

## Configuration

Configure the `.env` file with your settings:

```env
# Server Configuration
PORT=4005
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-merchant-onboarding

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@rez.com

# Frontend URL for email links
FRONTEND_URL=http://localhost:3000

# Admin Emails (comma-separated)
ADMIN_EMAILS=admin@rez.com

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

## Running the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register a new merchant |
| POST | `/login` | Login merchant |
| POST | `/verify-email` | Verify email with token |
| POST | `/resend-verification` | Resend verification email |
| GET | `/me` | Get current merchant profile |
| POST | `/forgot-password` | Request password reset |
| POST | `/reset-password` | Reset password with token |
| POST | `/change-password` | Change password (authenticated) |

### KYC (`/api/kyc`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Get current KYC status |
| GET | `/` | Get full KYC details |
| POST | `/submit` | Submit KYC information |
| POST | `/documents` | Upload KYC document |
| POST | `/documents/upload-batch` | Upload multiple documents |
| DELETE | `/documents/:type` | Delete a document |
| GET | `/required` | Get list of required documents |

### Business (`/api/business`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get business details |
| PUT | `/` | Update business details |
| POST | `/submit` | Submit for verification |
| PUT | `/bank` | Update bank details |
| GET | `/verification-status` | Get verification status |

### Approval (`/api/approval`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/merchants` | Get merchants pending approval |
| GET | `/merchants/:id` | Get merchant details |
| POST | `/kyc/review` | Review KYC documents |
| POST | `/kyc/document/:id/:type/review` | Review specific document |
| POST | `/business/review` | Review business details |
| POST | `/merchant/approve` | Final merchant approval |
| POST | `/merchant/reject` | Reject merchant application |
| GET | `/stats` | Get approval statistics |

## Merchant Status Flow

```
pending → email_verified → kyc_submitted → kyc_verified
                                            ↓
                                    business_submitted → under_review
                                                               ↓
                                                         approved/rejected
```

## KYC Document Types

| Type | Description | Required |
|------|-------------|----------|
| `pan_card` | PAN Card copy | Yes |
| `address_proof` | Aadhar, Voter ID, or Passport | Yes |
| `bank_account_proof` | Cancelled cheque or bank statement | Yes |
| `gst_certificate` | GST Registration Certificate | If GST registered |
| `business_address_proof` | Business address proof | No |

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": [ ... ] // For validation errors
}
```

## Security Features

- JWT-based authentication
- Password hashing with bcrypt (12 rounds)
- Rate limiting on authentication endpoints
- Helmet.js security headers
- CORS configuration
- Input validation with Zod
- File type and size validation

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

## Deployment

### Render

Use the included `render.yaml` for Render deployment:

```bash
# With Render CLI
render deploy
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4005
CMD ["npm", "start"]
```

## License

Private - ReZ Platform

## Support

For support, contact support@rez.com
