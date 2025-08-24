#!/bin/bash
# Simple Docker Application Runner
# This script runs the Book Review Platform application in Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLEANUP=false

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run the Book Review Platform application in Docker

OPTIONS:
    -c, --cleanup           Clean up Docker containers and images
    -h, --help              Show this help message

EXAMPLES:
    $0                      # Run the application
    $0 -c                   # Clean up Docker resources

WHAT THIS DOES:
    - Builds and runs the Node.js application in Docker
    - Sets up MongoDB container for local testing
    - Exposes the application on http://localhost:3001
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--cleanup)
            CLEANUP=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Cleanup function
cleanup_docker() {
    print_status "Cleaning up Docker resources..."
    
    # Stop and remove containers
    docker stop book-review-app 2>/dev/null || true
    docker stop book-review-mongo 2>/dev/null || true
    
    docker rm book-review-app 2>/dev/null || true
    docker rm book-review-mongo 2>/dev/null || true
    
    # Remove network
    docker network rm book-review-network 2>/dev/null || true
    
    # Remove volumes
    docker volume rm book-review-data 2>/dev/null || true
    
    print_success "Docker cleanup completed"
}

# If cleanup requested, do it and exit
if [[ "$CLEANUP" == true ]]; then
    cleanup_docker
    exit 0
fi

print_status "Starting Book Review Platform application in Docker"

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if backend directory exists
BACKEND_DIR="$PROJECT_DIR/backend"
if [[ ! -d "$BACKEND_DIR" ]]; then
    print_error "Backend directory not found: $BACKEND_DIR"
    exit 1
fi

# Create Docker network
print_status "Creating Docker network..."
docker network create book-review-network 2>/dev/null || true

# Create volume for MongoDB data
print_status "Creating Docker volume..."
docker volume create book-review-data 2>/dev/null || true

# Start MongoDB container
print_status "Starting MongoDB container..."
if ! docker ps | grep -q book-review-mongo; then
    docker run -d \
        --name book-review-mongo \
        --network book-review-network \
        -v book-review-data:/data/db \
        -p 27017:27017 \
        mongo:5.0 &> /dev/null
    
    print_status "Waiting for MongoDB to be ready..."
    for i in {1..30}; do
        if docker exec book-review-mongo mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
            print_success "MongoDB is ready"
            break
        fi
        sleep 2
        if [[ $i -eq 30 ]]; then
            print_error "MongoDB failed to start"
            exit 1
        fi
    done
else
    print_success "MongoDB container already running"
fi

# Create simple Dockerfile for the application
print_status "Creating application Dockerfile..."
cat > "$BACKEND_DIR/Dockerfile.simple" << 'EOF'
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build application
RUN npm run build

# Create ecosystem file for PM2
RUN echo 'module.exports = {' > ecosystem.config.js && \
    echo '  apps: [{' >> ecosystem.config.js && \
    echo '    name: "book-review-api",' >> ecosystem.config.js && \
    echo '    script: "./dist/app.js",' >> ecosystem.config.js && \
    echo '    instances: 1,' >> ecosystem.config.js && \
    echo '    env: {' >> ecosystem.config.js && \
    echo '      NODE_ENV: "development",' >> ecosystem.config.js && \
    echo '      PORT: 5000' >> ecosystem.config.js && \
    echo '    }' >> ecosystem.config.js && \
    echo '  }]' >> ecosystem.config.js && \
    echo '};' >> ecosystem.config.js

# Install PM2 globally
RUN npm install -g pm2

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
EOF

# Build application Docker image
print_status "Building application Docker image..."
cd "$BACKEND_DIR"
if docker build -f Dockerfile.simple -t book-review-app:latest . &> /tmp/docker_build.log; then
    print_success "Application Docker image built successfully"
else
    print_error "Failed to build application Docker image"
    echo "Build log:"
    cat /tmp/docker_build.log
    exit 1
fi

# Start application container
print_status "Starting application container..."
if ! docker ps | grep -q book-review-app; then
    docker run -d \
        --name book-review-app \
        --network book-review-network \
        -p 3001:5000 \
        -e NODE_ENV=development \
        -e PORT=5000 \
        -e MONGO_URI="mongodb://book-review-mongo:27017/bookreviews_dev" \
        -e JWT_SECRET="local-development-jwt-secret-key" \
        book-review-app:latest &> /dev/null
else
    print_warning "Application container already running"
fi

# Wait for application to be ready
print_status "Waiting for application to be ready..."
for i in {1..60}; do
    if curl -f -s http://localhost:3001/health &> /dev/null; then
        print_success "Application is ready and healthy!"
        break
    fi
    sleep 2
    if [[ $i -eq 60 ]]; then
        print_error "Application failed to start within timeout"
        print_status "Container logs:"
        docker logs book-review-app | tail -20
        exit 1
    fi
done

# Test the application
print_status "Testing application endpoints..."

# Test health endpoint
if curl -f -s http://localhost:3001/health | jq -e '.status == "OK"' &> /dev/null; then
    print_success "✅ Health check passed"
else
    print_warning "⚠️ Health check failed"
fi

# Test books endpoint
if curl -f -s http://localhost:3001/api/v1/books &> /dev/null; then
    print_success "✅ Books API endpoint accessible"
else
    print_warning "⚠️ Books API endpoint test failed (may need database seeding)"
fi

# Show application information
print_success "🎉 Application is running successfully!"

echo ""
echo "=========================================="
echo "    APPLICATION INFORMATION"
echo "=========================================="
echo "🌐 Application URL: http://localhost:3001"
echo "🔍 Health Check: http://localhost:3001/health"
echo "📚 Books API: http://localhost:3001/api/v1/books"
echo "🗄️ MongoDB: mongodb://localhost:27017"
echo "=========================================="

echo ""
print_status "🧪 Test your application:"
echo "  curl http://localhost:3001/health"
echo "  curl http://localhost:3001/api/v1/books"
echo ""

print_status "🔍 Monitor your application:"
echo "  docker logs book-review-app -f"
echo "  docker exec book-review-app pm2 monit"
echo "  docker stats book-review-app"
echo ""

print_status "🧹 Clean up when done:"
echo "  $0 -c"
echo ""

# Show container status
print_status "Container Status:"
docker ps --filter "name=book-review-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Cleanup build artifacts
rm -f "$BACKEND_DIR/Dockerfile.simple" /tmp/docker_build.log

print_success "Setup completed! Your application is ready for testing."
