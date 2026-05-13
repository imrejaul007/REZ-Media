# ReZ Graph API

Graph API service for querying the ReZ knowledge graph. Provides node and edge operations, path finding, and pre-built queries for consumer profiles, merchant connections, and more.

## Architecture

- **Express.js** server with TypeScript
- **MongoDB** with Mongoose for data persistence
- **Node/Edge Model** for graph representation
- **Pre-built Queries** for common graph operations

## Graph Structure

### Node Types
| Type | Description |
|------|-------------|
| `consumer` | End user/customer |
| `merchant` | Business/seller |
| `product` | Product or service |
| `category` | Product category |
| `location` | Geographic location |
| `device` | User device |
| `app` | Application |

### Edge Types
| Type | Description |
|------|-------------|
| `ordered` | Consumer ordered a product |
| `browsed` | Consumer browsed a product |
| `liked` | Consumer liked a product |
| `visited` | Consumer visited a merchant/location |
| `linked_to` | Connection between entities |
| `similar_to` | Similarity relationship |

## API Endpoints

### Node Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/nodes` | Create a node |
| GET | `/nodes` | List nodes with filters |
| GET | `/nodes/:nodeId` | Get node by ID |
| PATCH | `/nodes/:nodeId` | Update a node |
| DELETE | `/nodes/:nodeId` | Delete a node |
| POST | `/nodes/:nodeId/labels` | Add labels |
| GET | `/nodes/:nodeId/degree` | Get connection count |

### Edge Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/edges` | Create an edge |
| GET | `/edges` | List edges with filters |
| GET | `/edges/:edgeId` | Get edge by ID |
| PATCH | `/edges/:edgeId` | Update an edge |
| DELETE | `/edges/:edgeId` | Delete an edge |
| GET | `/edges/node/:nodeId/outgoing` | Get outgoing edges |
| GET | `/edges/node/:nodeId/incoming` | Get incoming edges |
| POST | `/edges/increment` | Increment edge weight |

### Pre-built Queries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/queries/consumer/:nodeId/360` | Full consumer profile |
| GET | `/queries/consumer/:nodeId/similar` | Find similar consumers |
| GET | `/queries/consumer/:nodeId/journey` | Consumer activity timeline |
| GET | `/queries/merchant/:nodeId/connections` | Merchant stats and connections |
| GET | `/queries/paths/:source/:target` | Find paths between nodes |
| GET | `/queries/shortest-path/:source/:target` | Shortest path |
| GET | `/queries/neighborhood/:nodeId` | Local graph neighborhood |
| GET | `/queries/common-neighbors/:id1/:id2` | Common neighbors |
| GET | `/queries/reachable/:nodeId` | Reachable nodes |
| GET | `/queries/stats` | Graph statistics |

### Internal Endpoints
Add `X-Internal-Token` header for service-to-service calls:
- `/internal/nodes/*`
- `/internal/edges/*`
- `/internal/queries/*`

## Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3008) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `INTERNAL_SERVICE_TOKENS_JSON` | Yes | Service-to-service tokens |
| `CORS_ORIGINS` | No | Allowed CORS origins |

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Example Usage

### Create a Consumer Node
```bash
curl -X POST http://localhost:3008/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "type": "consumer",
    "externalId": "user-123",
    "properties": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "labels": ["vip", "early-adopter"]
  }'
```

### Create an Edge (Consumer ordered Product)
```bash
curl -X POST http://localhost:3008/edges \
  -H "Content-Type: application/json" \
  -d '{
    "sourceNodeId": "<consumer-node-id>",
    "targetNodeId": "<product-node-id>",
    "type": "ordered",
    "weight": 1.0
  }'
```

### Get Consumer 360 Profile
```bash
curl http://localhost:3008/queries/consumer/<node-id>/360
```

### Find Shortest Path
```bash
curl "http://localhost:3008/queries/shortest-path/<node1>/<node2>?maxDepth=5&edgeTypes=ordered,liked"
```

## Health Check

```bash
curl http://localhost:3008/health
```

## License

Proprietary - ReZ Platform
