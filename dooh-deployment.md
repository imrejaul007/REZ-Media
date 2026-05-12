# DOOH Deployment Guide

Complete guide for deploying the DOOH ecosystem to production.

---

## Prerequisites

- Node.js 20+
- Docker (optional)
- PostgreSQL or MongoDB (for persistence)
- Redis (for caching)

---

## Local Development

### 1. Setup Environment

```bash
# Navigate to DOOH service
cd REZ-Media/rez-dooh-service

# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

### 2. Required Environment Variables

```bash
# REQUIRED - Service will fail to start without these
INTERNAL_SERVICE_TOKEN=your-secure-random-token
DOOH_API_KEY=your-dooh-api-key

# Optional
PORT=4018
DOOH_SERVER_URL=https://dooh.rezapp.com
ALLOWED_ORIGINS=https://rezapp.com,https://www.rezapp.com
```

### 3. Install & Run

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Or run production
npm start
```

### 4. Verify

```bash
# Health check
curl http://localhost:4018/health

# Should return:
# {"status":"ok","service":"dooh-service","version":"1.0.0","timestamp":"..."}
```

---

## Docker Deployment

### Build Image

```bash
cd REZ-Media/rez-dooh-service

# Build image
docker build -t rez/dooh-service:latest .

# Or build for ARM (Apple Silicon)
docker buildx build --platform linux/amd64 -t rez/dooh-service:latest .
```

### Run Container

```bash
docker run -d \
  --name dooh-service \
  -p 4018:4018 \
  -e INTERNAL_SERVICE_TOKEN=your-token \
  -e DOOH_API_KEY=your-key \
  -e NODE_ENV=production \
  rez/dooh-service:latest
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  dooh-service:
    build: .
    ports:
      - "4018:4018"
    environment:
      - NODE_ENV=production
      - PORT=4018
      - INTERNAL_SERVICE_TOKEN=${DOOH_SERVICE_TOKEN}
      - DOOH_API_KEY=${DOOH_API_KEY}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4018/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f dooh-service

# Restart
docker-compose restart dooh-service
```

---

## Render Deployment

### 1. Connect Repository

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select `REZ-Media/rez-dooh-service`

### 2. Configure Build

| Setting | Value |
|---------|-------|
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Environment | Node |

### 3. Environment Variables

Add the following in Render dashboard:

```bash
# Required
INTERNAL_SERVICE_TOKEN=<generate-secure-token>
DOOH_API_KEY=<generate-secure-key>

# Optional
PORT=4018
NODE_ENV=production
ALLOWED_ORIGINS=https://rezapp.com,https://www.rezapp.com

# For Redis caching (optional)
REDIS_URL=redis://redis:6379
```

### 4. Health Check

Set health check path: `/health`

### 5. Deploy

Click "Create Web Service" - Render will automatically deploy on push.

---

## Vercel Deployment (dooh-screen-app)

### 1. Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com)
2. Click "Add New" → "Project"
3. Import `REZ-Media/dooh-screen-app`

### 2. Configure

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Root Directory | `./` |
| Build Command | `npm run build` |
| Output Directory | `.next` |

### 3. Environment Variables

```bash
# Required
NEXT_PUBLIC_DOOH_API_URL=https://dooh-api.rezapp.com
INTERNAL_SERVICE_TOKEN=<token>

# Optional
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
```

### 4. Deploy

Click "Deploy" - Vercel will automatically deploy on push.

---

## Kubernetes Deployment

### Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dooh-service
  labels:
    app: dooh-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dooh-service
  template:
    metadata:
      labels:
        app: dooh-service
    spec:
      containers:
        - name: dooh-service
          image: rez/dooh-service:latest
          ports:
            - containerPort: 4018
          env:
            - name: INTERNAL_SERVICE_TOKEN
              valueFrom:
                secretKeyRef:
                  name: dooh-secrets
                  key: internal-token
            - name: DOOH_API_KEY
              valueFrom:
                secretKeyRef:
                  name: dooh-secrets
                  key: api-key
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "4018"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 4018
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 4018
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: dooh-service
spec:
  selector:
    app: dooh-service
  ports:
    - port: 80
      targetPort: 4018
  type: LoadBalancer
```

### Apply Configuration

```bash
# Create secret
kubectl create secret generic dooh-secrets \
  --from-literal=internal-token=YOUR_TOKEN \
  --from-literal=api-key=YOUR_API_KEY

# Apply deployment
kubectl apply -f deployment.yaml

# Check status
kubectl get pods -l app=dooh-service

# View logs
kubectl logs -l app=dooh-service -f
```

---

## Mobile App Deployment

### DOOH Mobile (React Native/Expo)

```bash
cd REZ-Media/dooh-mobile

# Install dependencies
npm install

# Build for iOS
eas build --platform ios --profile preview

# Build for Android
eas build --platform android --profile preview

# Or submit to stores
eas submit --platform ios
eas submit --platform android
```

### Required Environment Variables

```bash
# .env
EXPO_PUBLIC_DOOH_API_URL=https://dooh-api.rezapp.com
```

---

## Production Checklist

### Security

- [ ] `INTERNAL_SERVICE_TOKEN` is set and secure (min 32 chars)
- [ ] `DOOH_API_KEY` is set and secure
- [ ] `ALLOWED_ORIGINS` includes only production domains
- [ ] CORS is not set to `*`
- [ ] Health checks don't expose sensitive data
- [ ] Error responses don't leak stack traces

### Configuration

- [ ] `NODE_ENV=production`
- [ ] `PORT` is configured (default 4018)
- [ ] `DOOH_SERVER_URL` points to correct API URL
- [ ] Rate limiting is enabled
- [ ] Request logging is configured

### Monitoring

- [ ] Health check endpoint configured (`/health`)
- [ ] Readiness check configured (`/ready`)
- [ ] Metrics are being collected
- [ ] Alerts are set up for:
  - High error rate
  - Service down
  - High latency

### Database

- [ ] Database migrations are complete
- [ ] Indexes are created
- [ ] Backups are configured
- [ ] Connection pooling is configured

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker logs dooh-service

# Common issues:
# 1. Missing INTERNAL_SERVICE_TOKEN
# 2. Port already in use
# 3. Database connection failed
```

### Health Check Fails

```bash
# Manual health check
curl http://localhost:4018/health
curl http://localhost:4018/ready

# Check service logs for errors
```

### Rate Limited

```bash
# Check rate limit headers
curl -I http://localhost:4018/api/screens

# Response headers:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 95
# X-RateLimit-Reset: 1715500000
```

### Authentication Fails

```bash
# Verify token is correct
curl -H "X-Internal-Token: YOUR_TOKEN" http://localhost:4018/api/screens

# Should return 200, not 401
```

---

## Rollback

### Docker

```bash
# List available images
docker images rez/dooh-service

# Rollback to previous version
docker pull rez/dooh-service:previous-tag
docker stop dooh-service
docker rm dooh-service
docker run -d --name dooh-service ... rez/dooh-service:previous-tag
```

### Render

1. Go to Render Dashboard
2. Select your service
3. Click "Deployments"
4. Find the last working deployment
5. Click "Actions" → "Rollback"

### Kubernetes

```bash
# Rollback to previous version
kubectl rollout undo deployment/dooh-service

# Or rollback to specific revision
kubectl rollout undo deployment/dooh-service --to-revision=2
```

---

## Support

- Documentation: [REZ-Media/dooh-architecture.md](dooh-architecture.md)
- API Spec: [REZ-Media/rez-dooh-service/api-spec.yaml](rez-dooh-service/api-spec.yaml)
- Type Library: [RTNM-Group/shared-types/dooh/README.md](RTNM-Group/shared-types/dooh/README.md)
