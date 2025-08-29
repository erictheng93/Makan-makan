# MakanMakan Image Processor

A powerful, serverless image processing service built on Cloudflare Workers, featuring automatic optimization, variant generation, and advanced analytics.

## 🚀 Features

### Core Functionality
- **Image Upload & Storage** - Secure upload with validation and preprocessing
- **Automatic Optimization** - Smart compression and format conversion
- **Multiple Variants** - Generate thumbnails, responsive sizes, and custom variants
- **Real-time Transformations** - On-demand image processing with caching
- **Advanced Analytics** - Usage tracking, performance metrics, and insights
- **Bulk Operations** - Batch processing and management
- **Security Scanning** - Malicious content detection and validation

### Technical Highlights
- **Serverless Architecture** - Built on Cloudflare Workers for global edge deployment
- **Cloudflare Images Integration** - Leverages Cloudflare's image optimization platform
- **SQLite Database** - Metadata storage with Cloudflare D1
- **KV Caching** - Lightning-fast content delivery
- **R2 Storage** - Cost-effective object storage
- **Real-time Processing** - Asynchronous job processing
- **Role-based Access Control** - Multi-tenant security

## 🏗️ Architecture

```
┌─────────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Client Upload     │───▶│  Image Processor │───▶│  Cloudflare Images  │
│   (Web/Mobile/API)  │    │     Worker       │    │      Platform       │
└─────────────────────┘    └──────────────────┘    └─────────────────────┘
                                     │
                                     ▼
┌─────────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Analytics &       │◀───│  Metadata        │───▶│   Cache & CDN       │
│   Reporting         │    │  Database (D1)   │    │   (KV + Images)     │
└─────────────────────┘    └──────────────────┘    └─────────────────────┘
```

## 📋 API Endpoints

### Image Management
- `POST /images/upload` - Upload new image
- `GET /images/:id` - Get image metadata
- `PUT /images/:id` - Update image metadata
- `DELETE /images/:id` - Delete image
- `GET /images` - List images with filtering
- `GET /images/:id/view` - Optimized image delivery

### Image Processing
- `POST /images/:id/process` - Transform image
- `GET /images/jobs/:jobId` - Check processing status
- `POST /images/bulk` - Bulk operations

### Analytics
- `GET /analytics/dashboard` - Usage overview
- `GET /analytics/storage` - Storage statistics
- `GET /analytics/usage` - View analytics
- `GET /analytics/performance` - Processing metrics
- `GET /analytics/export` - Export data

### System
- `GET /health` - Service health check
- `GET /info` - Service information

## 🛠️ Setup & Deployment

### Prerequisites
- Node.js 20+
- Cloudflare account with Images enabled
- Wrangler CLI: `npm install -g wrangler`

### Environment Setup

1. **Clone and install dependencies**
```bash
cd apps/image-processor
npm install
```

2. **Configure environment variables in wrangler.toml**
```toml
[vars]
CLOUDFLARE_ACCOUNT_ID = "your_account_id"
CLOUDFLARE_IMAGES_API_TOKEN = "your_images_token"
JWT_SECRET = "your_jwt_secret"
MAX_IMAGE_SIZE_MB = "10"
ALLOWED_MIME_TYPES = "image/jpeg,image/png,image/webp,image/gif"
```

3. **Set up Cloudflare resources**
```bash
# Create KV namespace for caching
wrangler kv:namespace create IMAGE_CACHE

# Create R2 bucket for storage
wrangler r2 bucket create makanmakan-images

# Create D1 database
wrangler d1 create makanmakan-images-db

# Apply database schema
wrangler d1 execute makanmakan-images-db --file=schema.sql
```

4. **Update wrangler.toml with resource IDs**

### Development
```bash
npm run dev
```

### Deployment
```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

## 🎯 Usage Examples

### Upload Image
```typescript
const formData = new FormData()
formData.append('file', imageFile)

const response = await fetch('/images/upload?category=menu&tags=food,noodles', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token'
  },
  body: formData
})

const result = await response.json()
// Returns: { success: true, data: { id, variants, ... } }
```

### Get Optimized Image
```html
<!-- Automatic format optimization based on browser support -->
<img src="/images/abc123/view?width=600&height=400&fit=cover&format=webp" 
     alt="Delicious noodles" />

<!-- Predefined variants -->
<img src="/images/abc123/view?variant=thumbnail" alt="Thumbnail" />
```

### Transform Image
```typescript
const transformation = {
  transformations: [
    {
      type: 'resize',
      width: 800,
      height: 600,
      fit: 'cover'
    },
    {
      type: 'blur',
      radius: 5
    }
  ]
}

const response = await fetch('/images/abc123/process', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(transformation)
})

// Returns: { success: true, data: { jobId, status: 'pending' } }
```

### Get Analytics
```typescript
const response = await fetch('/analytics/dashboard?restaurantId=123&dateFrom=2024-01-01', {
  headers: {
    'Authorization': 'Bearer your_jwt_token'
  }
})

const analytics = await response.json()
// Returns usage stats, storage info, performance metrics
```

## 🔧 Configuration Options

### Image Variants
Default variants are automatically generated:
- `thumbnail`: 150x150px
- `small`: 300x300px  
- `medium`: 600x600px
- `large`: 1200x1200px
- `original`: Original size

### Transformation Options
- **Resize**: `width`, `height`, `fit` (scale-down, contain, cover, crop, pad)
- **Crop**: Custom crop with gravity control
- **Rotate**: Any angle rotation
- **Blur**: Gaussian blur effect
- **Brighten/Darken**: Brightness adjustment
- **Sharpen**: Image sharpening

### Security Features
- File type validation
- Magic number verification
- Size limits enforcement
- Rate limiting
- Access control
- Malicious content detection

## 📊 Performance & Monitoring

### Metrics Tracked
- Upload success/failure rates
- Processing times
- Cache hit ratios
- Storage usage
- View counts per image
- Error rates and types

### Health Monitoring
The service includes comprehensive health checks:
- Database connectivity
- KV store operations
- R2 bucket access
- Processing queue status

### Alerting
Automatic notifications via Slack webhook for:
- Service errors
- Performance degradation
- High failure rates
- Daily usage reports

## 🔐 Security & Access Control

### Authentication
- JWT-based authentication
- API key support for service-to-service
- Role-based permissions (Admin, Owner, Chef, etc.)

### Access Control
- Restaurant-level isolation
- User-based permissions
- Public/private image support
- Secure signed URLs

### Validation
- File type verification
- Size limits
- Content scanning
- Rate limiting per user/IP

## 🚀 Advanced Features

### Batch Processing
```typescript
const bulkOperation = {
  imageIds: ['img1', 'img2', 'img3'],
  operation: 'update_category',
  data: { category: 'menu' }
}

await fetch('/images/bulk', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' },
  body: JSON.stringify(bulkOperation)
})
```

### Custom Transformations
```typescript
const customTransform = {
  transformations: [
    { type: 'resize', width: 400, height: 300 },
    { type: 'rotate', angle: 90 },
    { type: 'blur', radius: 2 }
  ]
}
```

### Analytics Export
```typescript
const exportData = await fetch('/analytics/export?type=usage&format=csv&dateFrom=2024-01-01')
// Returns downloadable CSV/JSON with usage data
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

## 📝 Database Schema

The service uses SQLite (Cloudflare D1) with these main tables:
- `images` - Image metadata and variants
- `image_processing_jobs` - Async processing queue
- `image_views` - Usage analytics tracking

See `schema.sql` for complete database structure.

## 🤝 Integration

### With Main API
The image processor integrates seamlessly with the main MakanMakan API:
- Menu item images
- Restaurant photos
- User avatars
- QR code images

### Webhook Events
Configure webhooks to receive notifications for:
- Upload completion
- Processing finished
- Error events
- Usage milestones

## 📈 Scaling & Performance

### Global Edge Deployment
- Deployed to 100+ Cloudflare locations
- Sub-100ms response times globally
- Automatic failover and redundancy

### Optimization
- Intelligent caching strategies
- Format optimization (WebP, AVIF)
- Size optimization per device
- Lazy loading support

### Cost Management
- Pay-per-use pricing
- Efficient storage with R2
- Automatic cleanup of unused images
- Usage analytics and budgeting

## 🆘 Troubleshooting

### Common Issues
1. **Upload Failures**: Check file size/type limits
2. **Processing Stuck**: Monitor job queue status
3. **Authentication Errors**: Verify JWT token validity
4. **Rate Limits**: Check per-user/IP limits

### Debug Endpoints
- `/health` - Service status
- `/info` - Configuration details
- `/analytics/performance` - Processing metrics

### Logs & Monitoring
- Cloudflare Workers logs
- Slack error notifications
- Performance dashboards
- Usage analytics

## 📚 API Documentation

Complete API documentation available at `/docs` endpoint when deployed.

For support and questions, refer to the main MakanMakan documentation or contact the development team.