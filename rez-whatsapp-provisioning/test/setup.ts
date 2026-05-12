import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.TWILIO_ACCOUNT_SID = 'ACtest123456789';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_API_KEY = 'SKtest123456789';
process.env.TWILIO_API_SECRET = 'test_api_secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_whatsapp_provisioning';
