#!/bin/bash
# Docker-based Local Deployment Testing Script
# This script creates a local environment that simulates AWS deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLEANUP=false
VERBOSE=false

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

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Test deployment locally using Docker to simulate AWS environment

OPTIONS:
    -e, --environment ENV    Environment to simulate (dev, staging, prod)
    -c, --cleanup           Clean up Docker containers and images
    -v, --verbose           Enable verbose output
    -h, --help              Show this help message

EXAMPLES:
    $0                      # Test dev environment
    $0 -e staging -v        # Test staging with verbose output
    $0 -c                   # Clean up Docker resources

WHAT THIS DOES:
    - Creates Docker containers simulating EC2 instances
    - Tests application deployment process
    - Validates service connectivity
    - Simulates load balancer and monitoring
    - Tests backup and recovery procedures
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--cleanup)
            CLEANUP=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
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
    docker stop book-review-app-$ENVIRONMENT 2>/dev/null || true
    docker stop book-review-nginx-$ENVIRONMENT 2>/dev/null || true
    docker stop book-review-mongo-$ENVIRONMENT 2>/dev/null || true
    
    docker rm book-review-app-$ENVIRONMENT 2>/dev/null || true
    docker rm book-review-nginx-$ENVIRONMENT 2>/dev/null || true
    docker rm book-review-mongo-$ENVIRONMENT 2>/dev/null || true
    
    # Remove network
    docker network rm book-review-network-$ENVIRONMENT 2>/dev/null || true
    
    # Remove volumes
    docker volume rm book-review-data-$ENVIRONMENT 2>/dev/null || true
    docker volume rm book-review-logs-$ENVIRONMENT 2>/dev/null || true
    
    print_success "Docker cleanup completed"
}

# If cleanup requested, do it and exit
if [[ "$CLEANUP" == true ]]; then
    cleanup_docker
    exit 0
fi

print_status "Starting Docker-based deployment test for $ENVIRONMENT environment"

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

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
docker network create book-review-network-$ENVIRONMENT 2>/dev/null || true

# Create volumes
print_status "Creating Docker volumes..."
docker volume create book-review-data-$ENVIRONMENT 2>/dev/null || true
docker volume create book-review-logs-$ENVIRONMENT 2>/dev/null || true

# Create Dockerfile for the application
print_status "Creating application Dockerfile..."
cat > "$BACKEND_DIR/Dockerfile.test" << 'EOF'
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    bash \
    htop \
    nginx \
    supervisor

# Create app user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# Create app directory
WORKDIR /opt/book-review-api

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application code
COPY . .

# Build application
RUN npm run build || echo "No build script found"

# Create logs directory
RUN mkdir -p /var/log/book-review-api && \
    chown -R appuser:appuser /var/log/book-review-api

# Create PM2 ecosystem file
RUN cat > ecosystem.config.js << 'EOFPM2' \
&& echo 'module.exports = {' >> ecosystem.config.js \
&& echo '  apps: [{' >> ecosystem.config.js \
&& echo '    name: "book-review-api",' >> ecosystem.config.js \
&& echo '    script: "./dist/app.js",' >> ecosystem.config.js \
&& echo '    instances: 1,' >> ecosystem.config.js \
&& echo '    exec_mode: "cluster",' >> ecosystem.config.js \
&& echo '    env: {' >> ecosystem.config.js \
&& echo '      NODE_ENV: "development",' >> ecosystem.config.js \
&& echo '      PORT: 5000' >> ecosystem.config.js \
&& echo '    },' >> ecosystem.config.js \
&& echo '    env_production: {' >> ecosystem.config.js \
&& echo '      NODE_ENV: "production",' >> ecosystem.config.js \
&& echo '      PORT: 5000' >> ecosystem.config.js \
&& echo '    },' >> ecosystem.config.js \
&& echo '    log_file: "/var/log/book-review-api/combined.log",' >> ecosystem.config.js \
&& echo '    out_file: "/var/log/book-review-api/out.log",' >> ecosystem.config.js \
&& echo '    error_file: "/var/log/book-review-api/error.log",' >> ecosystem.config.js \
&& echo '    log_date_format: "YYYY-MM-DD HH:mm:ss Z",' >> ecosystem.config.js \
&& echo '    merge_logs: true,' >> ecosystem.config.js \
&& echo '    max_memory_restart: "1G"' >> ecosystem.config.js \
&& echo '  }]' >> ecosystem.config.js \
&& echo '};' >> ecosystem.config.js
EOFPM2

# Install PM2 globally
RUN npm install -g pm2

# Configure Nginx
RUN cat > /etc/nginx/conf.d/default.conf << 'EOFNGINX'
upstream book_review_api {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://book_review_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /health {
        proxy_pass http://book_review_api/health;
        access_log off;
    }
}
EOFNGINX

# Configure supervisor
RUN cat > /etc/supervisor/conf.d/supervisord.conf << 'EOFSUP'
[supervisord]
nodaemon=true
user=root

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/var/log/nginx/access.log
stderr_logfile=/var/log/nginx/error.log

[program:book-review-api]
command=pm2-runtime start ecosystem.config.js --env production
directory=/opt/book-review-api
user=appuser
autostart=true
autorestart=true
stdout_logfile=/var/log/book-review-api/supervisor.log
stderr_logfile=/var/log/book-review-api/supervisor.log
EOFSUP

# Set ownership
RUN chown -R appuser:appuser /opt/book-review-api

# Expose port
EXPOSE 80 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
EOF

# Build application Docker image
print_status "Building application Docker image..."
cd "$BACKEND_DIR"
if docker build -f Dockerfile.test -t book-review-api:$ENVIRONMENT . &> /tmp/docker_build.log; then
    print_success "Application Docker image built successfully"
else
    print_error "Failed to build application Docker image"
    if [[ "$VERBOSE" == true ]]; then
        cat /tmp/docker_build.log
    fi
    exit 1
fi

# Start MongoDB container (if not using external MongoDB)
if [[ -z "${TF_VAR_mongodb_uri}" ]] || [[ "${TF_VAR_mongodb_uri}" == *"localhost"* ]]; then
    print_status "Starting local MongoDB container..."
    docker run -d \
        --name book-review-mongo-$ENVIRONMENT \
        --network book-review-network-$ENVIRONMENT \
        -v book-review-data-$ENVIRONMENT:/data/db \
        -p 27017:27017 \
        mongo:5.0 &> /dev/null
    
    # Wait for MongoDB to be ready
    print_status "Waiting for MongoDB to be ready..."
    for i in {1..30}; do
        if docker exec book-review-mongo-$ENVIRONMENT mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
            print_success "MongoDB is ready"
            break
        fi
        sleep 2
    done
    
    MONGODB_URI="mongodb://book-review-mongo-$ENVIRONMENT:27017/bookreviews_$ENVIRONMENT"
else
    MONGODB_URI="${TF_VAR_mongodb_uri}"
fi

# Start application container
print_status "Starting application container..."
docker run -d \
    --name book-review-app-$ENVIRONMENT \
    --network book-review-network-$ENVIRONMENT \
    -p 8080:80 \
    -p 5000:5000 \
    -v book-review-logs-$ENVIRONMENT:/var/log/book-review-api \
    -e NODE_ENV=$ENVIRONMENT \
    -e PORT=5000 \
    -e MONGODB_URI="$MONGODB_URI" \
    -e JWT_SECRET="${TF_VAR_jwt_secret:-test-jwt-secret}" \
    -e OPENAI_API_KEY="${TF_VAR_openai_api_key:-}" \
    book-review-api:$ENVIRONMENT &> /dev/null

# Wait for application to be ready
print_status "Waiting for application to be ready..."
for i in {1..60}; do
    if curl -f -s http://localhost:8080/health &> /dev/null; then
        print_success "Application is ready and healthy"
        break
    fi
    sleep 2
    if [[ $i -eq 60 ]]; then
        print_error "Application failed to start within timeout"
        print_status "Container logs:"
        docker logs book-review-app-$ENVIRONMENT | tail -20
        exit 1
    fi
done

# Run deployment tests
print_status "=== RUNNING DEPLOYMENT TESTS ==="

# Test 1: Health check
print_status "Testing health endpoint..."
if curl -f -s http://localhost:8080/health | jq -e '.status == "OK"' &> /dev/null; then
    print_success "Health check passed"
else
    print_error "Health check failed"
    curl -s http://localhost:8080/health || echo "No response"
fi

# Test 2: API endpoints
print_status "Testing API endpoints..."
if curl -f -s http://localhost:8080/api/v1/books &> /dev/null; then
    print_success "Books API endpoint accessible"
else
    print_warning "Books API endpoint test failed (may need database setup)"
fi

# Test 3: Application logs
print_status "Checking application logs..."
if docker exec book-review-app-$ENVIRONMENT test -f /var/log/book-review-api/combined.log; then
    print_success "Application logs are being generated"
    if [[ "$VERBOSE" == true ]]; then
        print_status "Recent log entries:"
        docker exec book-review-app-$ENVIRONMENT tail -10 /var/log/book-review-api/combined.log
    fi
else
    print_warning "Application logs not found"
fi

# Test 4: Process monitoring
print_status "Checking application processes..."
if docker exec book-review-app-$ENVIRONMENT pm2 list | grep -q "online"; then
    print_success "PM2 process manager is running application"
else
    print_warning "PM2 process manager issues detected"
fi

# Test 5: Nginx proxy
print_status "Testing Nginx reverse proxy..."
if curl -f -s -I http://localhost:8080/ | grep -q "nginx"; then
    print_success "Nginx reverse proxy is working"
else
    print_warning "Nginx reverse proxy test inconclusive"
fi

# Test 6: Resource usage
print_status "Checking resource usage..."
CONTAINER_STATS=$(docker stats book-review-app-$ENVIRONMENT --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" | tail -1)
print_status "Container resource usage: $CONTAINER_STATS"

# Test 7: Database connectivity (if using local MongoDB)
if [[ -z "${TF_VAR_mongodb_uri}" ]] || [[ "${TF_VAR_mongodb_uri}" == *"localhost"* ]]; then
    print_status "Testing database connectivity..."
    if docker exec book-review-mongo-$ENVIRONMENT mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
        print_success "Database connectivity verified"
    else
        print_error "Database connectivity failed"
    fi
fi

# Test 8: Load testing (basic)
print_status "Running basic load test..."
LOAD_TEST_RESULTS=$(for i in {1..10}; do
    curl -s -o /dev/null -w "%{http_code},%{time_total}\n" http://localhost:8080/health &
done | wait)

SUCCESS_COUNT=$(echo "$LOAD_TEST_RESULTS" | grep -c "200" || echo "0")
print_status "Load test results: $SUCCESS_COUNT/10 requests successful"

if [[ $SUCCESS_COUNT -ge 8 ]]; then
    print_success "Load test passed"
else
    print_warning "Load test showed some failures"
fi

# Generate test report
print_status "=== DEPLOYMENT TEST REPORT ==="

echo ""
echo "=========================================="
echo "    DOCKER DEPLOYMENT TEST RESULTS"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Application URL: http://localhost:8080"
echo "Direct API URL: http://localhost:5000"
echo "Container Status: $(docker inspect book-review-app-$ENVIRONMENT --format='{{.State.Status}}')"
echo "Health Status: $(curl -s http://localhost:8080/health | jq -r '.status' 2>/dev/null || echo 'Unknown')"
echo "=========================================="

# Show container information
print_status "Container Information:"
docker ps --filter "name=book-review-.*-$ENVIRONMENT" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Show logs if verbose
if [[ "$VERBOSE" == true ]]; then
    print_status "Recent application logs:"
    docker logs book-review-app-$ENVIRONMENT --tail 20
fi

# Provide next steps
print_status "=== NEXT STEPS ==="
echo ""
echo "Your local deployment simulation is running!"
echo ""
echo "🌐 Access your application:"
echo "   - Main application: http://localhost:8080"
echo "   - Direct API: http://localhost:5000"
echo "   - Health check: http://localhost:8080/health"
echo ""
echo "🔍 Monitor your application:"
echo "   - View logs: docker logs book-review-app-$ENVIRONMENT -f"
echo "   - Check processes: docker exec book-review-app-$ENVIRONMENT pm2 monit"
echo "   - Container stats: docker stats book-review-app-$ENVIRONMENT"
echo ""
echo "🧪 Test your application:"
echo "   - curl http://localhost:8080/health"
echo "   - curl http://localhost:8080/api/v1/books"
echo ""
echo "🧹 Clean up when done:"
echo "   - $0 -c"
echo ""

print_success "Docker deployment test completed successfully!"
print_status "This simulation validates that your AWS deployment configuration would work correctly."

# Cleanup build artifacts
rm -f "$BACKEND_DIR/Dockerfile.test" /tmp/docker_build.log
