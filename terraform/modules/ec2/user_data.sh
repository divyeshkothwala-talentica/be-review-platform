#!/bin/bash
# User Data Script for Book Review Platform API Server
# This script sets up the Node.js application environment

set -e

# Variables from Terraform
APP_NAME="${app_name}"
APP_PORT="${app_port}"
NODE_ENV="${node_env}"
GITHUB_REPO="${github_repo}"
GITHUB_BRANCH="${github_branch}"
NODE_VERSION="${node_version}"
PM2_INSTANCES="${pm2_instances}"

# Log file for debugging
LOG_FILE="/var/log/user-data.log"
exec > >(tee -a $LOG_FILE)
exec 2>&1

echo "Starting user data script execution at $(date)"
echo "APP_NAME: $APP_NAME"
echo "NODE_ENV: $NODE_ENV"
echo "APP_PORT: $APP_PORT"

# Update system packages
echo "Updating system packages..."
yum update -y

# Install required packages
echo "Installing required packages..."
yum install -y \
    git \
    curl \
    wget \
    unzip \
    htop \
    nginx \
    amazon-cloudwatch-agent \
    awscli

# Install Node.js using NodeSource repository
echo "Installing Node.js version $NODE_VERSION..."
curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
yum install -y nodejs

# Verify Node.js installation
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Install PM2 globally
echo "Installing PM2..."
npm install -g pm2

# Create application user
echo "Creating application user..."
useradd -m -s /bin/bash appuser
usermod -aG wheel appuser

# Create application directory
echo "Creating application directory..."
APP_DIR="/opt/$APP_NAME"
mkdir -p $APP_DIR
chown appuser:appuser $APP_DIR

# Create logs directory
mkdir -p /var/log/$APP_NAME
chown appuser:appuser /var/log/$APP_NAME

# Create environment file
echo "Creating environment file..."
cat > /opt/$APP_NAME/.env << EOF
NODE_ENV=$NODE_ENV
PORT=$APP_PORT
%{ for key, value in environment_variables ~}
${key}=${value}
%{ endfor ~}
EOF

chown appuser:appuser /opt/$APP_NAME/.env
chmod 600 /opt/$APP_NAME/.env

# Clone application repository (if GitHub repo is provided)
if [ ! -z "$GITHUB_REPO" ]; then
    echo "Cloning application repository..."
    cd $APP_DIR
    sudo -u appuser git clone https://github.com/$GITHUB_REPO.git .
    sudo -u appuser git checkout $GITHUB_BRANCH
    
    # Install dependencies
    echo "Installing application dependencies..."
    cd $APP_DIR
    sudo -u appuser npm ci --production
    
    # Build application (if build script exists)
    if grep -q '"build"' package.json; then
        echo "Building application..."
        sudo -u appuser npm run build
    fi
else
    echo "No GitHub repository specified. Application will need to be deployed manually."
    # Create a basic package.json for manual deployment
    cat > $APP_DIR/package.json << EOF
{
  "name": "$APP_NAME",
  "version": "1.0.0",
  "description": "Book Review Platform API",
  "main": "dist/app.js",
  "scripts": {
    "start": "node dist/app.js",
    "dev": "nodemon src/app.ts"
  },
  "dependencies": {},
  "engines": {
    "node": ">=${NODE_VERSION}.0.0"
  }
}
EOF
    chown appuser:appuser $APP_DIR/package.json
fi

# Create PM2 ecosystem file
echo "Creating PM2 ecosystem file..."
cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: './dist/app.js',
    instances: $PM2_INSTANCES,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: $APP_PORT
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: $APP_PORT
    },
    log_file: '/var/log/$APP_NAME/combined.log',
    out_file: '/var/log/$APP_NAME/out.log',
    error_file: '/var/log/$APP_NAME/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

chown appuser:appuser $APP_DIR/ecosystem.config.js

# Configure Nginx as reverse proxy
echo "Configuring Nginx..."
cat > /etc/nginx/conf.d/$APP_NAME.conf << EOF
upstream $APP_NAME {
    server 127.0.0.1:$APP_PORT;
}

server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    
    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://$APP_NAME;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://$APP_NAME/health;
        access_log off;
    }
    
    # Static files (if any)
    location /static/ {
        alias $APP_DIR/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Remove default Nginx configuration
rm -f /etc/nginx/conf.d/default.conf

# Test Nginx configuration
nginx -t

# Configure CloudWatch Agent
echo "Configuring CloudWatch Agent..."
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
    "agent": {
        "metrics_collection_interval": 60,
        "run_as_user": "cwagent"
    },
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/$APP_NAME/combined.log",
                        "log_group_name": "/aws/ec2/$APP_NAME-$NODE_ENV",
                        "log_stream_name": "{instance_id}/application",
                        "timezone": "UTC"
                    },
                    {
                        "file_path": "/var/log/$APP_NAME/error.log",
                        "log_group_name": "/aws/ec2/$APP_NAME-$NODE_ENV",
                        "log_stream_name": "{instance_id}/error",
                        "timezone": "UTC"
                    },
                    {
                        "file_path": "/var/log/nginx/access.log",
                        "log_group_name": "/aws/ec2/$APP_NAME-$NODE_ENV",
                        "log_stream_name": "{instance_id}/nginx-access",
                        "timezone": "UTC"
                    },
                    {
                        "file_path": "/var/log/nginx/error.log",
                        "log_group_name": "/aws/ec2/$APP_NAME-$NODE_ENV",
                        "log_stream_name": "{instance_id}/nginx-error",
                        "timezone": "UTC"
                    }
                ]
            }
        }
    },
    "metrics": {
        "namespace": "CWAgent",
        "metrics_collected": {
            "cpu": {
                "measurement": [
                    "cpu_usage_idle",
                    "cpu_usage_iowait",
                    "cpu_usage_user",
                    "cpu_usage_system"
                ],
                "metrics_collection_interval": 60,
                "totalcpu": false
            },
            "disk": {
                "measurement": [
                    "used_percent"
                ],
                "metrics_collection_interval": 60,
                "resources": [
                    "*"
                ]
            },
            "diskio": {
                "measurement": [
                    "io_time"
                ],
                "metrics_collection_interval": 60,
                "resources": [
                    "*"
                ]
            },
            "mem": {
                "measurement": [
                    "mem_used_percent"
                ],
                "metrics_collection_interval": 60
            },
            "netstat": {
                "measurement": [
                    "tcp_established",
                    "tcp_time_wait"
                ],
                "metrics_collection_interval": 60
            },
            "swap": {
                "measurement": [
                    "swap_used_percent"
                ],
                "metrics_collection_interval": 60
            }
        }
    }
}
EOF

# Create systemd service for the application
echo "Creating systemd service..."
cat > /etc/systemd/system/$APP_NAME.service << EOF
[Unit]
Description=$APP_NAME Node.js Application
After=network.target

[Service]
Type=forking
User=appuser
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=$NODE_ENV
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 reload ecosystem.config.js --env production
ExecStop=/usr/bin/pm2 stop ecosystem.config.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
echo "Enabling and starting services..."
systemctl daemon-reload
systemctl enable nginx
systemctl enable amazon-cloudwatch-agent
systemctl enable $APP_NAME

# Start services
systemctl start nginx
systemctl start amazon-cloudwatch-agent

# Start application (only if code was cloned)
if [ ! -z "$GITHUB_REPO" ] && [ -f "$APP_DIR/dist/app.js" ]; then
    echo "Starting application..."
    systemctl start $APP_NAME
    
    # Wait for application to start
    sleep 10
    
    # Check if application is running
    if systemctl is-active --quiet $APP_NAME; then
        echo "Application started successfully"
    else
        echo "Failed to start application"
        systemctl status $APP_NAME
    fi
else
    echo "Application not started automatically. Deploy code and run: systemctl start $APP_NAME"
fi

# Create deployment script for future updates
echo "Creating deployment script..."
cat > /opt/$APP_NAME/deploy.sh << 'EOF'
#!/bin/bash
# Deployment script for Book Review Platform API

set -e

APP_NAME="${app_name}"
APP_DIR="/opt/$APP_NAME"
GITHUB_REPO="${github_repo}"
GITHUB_BRANCH="${github_branch}"

echo "Starting deployment at $(date)"

# Navigate to app directory
cd $APP_DIR

# Pull latest changes
if [ ! -z "$GITHUB_REPO" ]; then
    echo "Pulling latest changes from $GITHUB_BRANCH..."
    git fetch origin
    git reset --hard origin/$GITHUB_BRANCH
else
    echo "No Git repository configured. Manual deployment required."
    exit 1
fi

# Install/update dependencies
echo "Installing dependencies..."
npm ci --production

# Build application
if grep -q '"build"' package.json; then
    echo "Building application..."
    npm run build
fi

# Restart application
echo "Restarting application..."
pm2 reload ecosystem.config.js --env production

# Wait for application to be ready
sleep 5

# Check if application is running
if pm2 list | grep -q "$APP_NAME.*online"; then
    echo "Deployment completed successfully at $(date)"
else
    echo "Deployment failed - application not running"
    pm2 logs $APP_NAME --lines 20
    exit 1
fi
EOF

chmod +x /opt/$APP_NAME/deploy.sh
chown appuser:appuser /opt/$APP_NAME/deploy.sh

# Create health check script
cat > /opt/$APP_NAME/health-check.sh << EOF
#!/bin/bash
# Health check script

APP_PORT=$APP_PORT
HEALTH_URL="http://localhost:\$APP_PORT/health"

# Check if application responds
if curl -f -s \$HEALTH_URL > /dev/null; then
    echo "Application is healthy"
    exit 0
else
    echo "Application health check failed"
    exit 1
fi
EOF

chmod +x /opt/$APP_NAME/health-check.sh
chown appuser:appuser /opt/$APP_NAME/health-check.sh

# Setup log rotation
echo "Setting up log rotation..."
cat > /etc/logrotate.d/$APP_NAME << EOF
/var/log/$APP_NAME/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 appuser appuser
    postrotate
        /usr/bin/pm2 reloadLogs
    endscript
}
EOF

# Create cron job for health checks
echo "Setting up health check cron job..."
echo "*/5 * * * * appuser /opt/$APP_NAME/health-check.sh >> /var/log/$APP_NAME/health-check.log 2>&1" >> /etc/crontab

# Set up firewall (if needed)
echo "Configuring firewall..."
# Allow SSH, HTTP, HTTPS, and application port
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport $APP_PORT -j ACCEPT

# Save iptables rules
service iptables save 2>/dev/null || true

echo "User data script completed successfully at $(date)"
echo "Application directory: $APP_DIR"
echo "Application logs: /var/log/$APP_NAME/"
echo "Nginx configuration: /etc/nginx/conf.d/$APP_NAME.conf"
echo "PM2 ecosystem: $APP_DIR/ecosystem.config.js"
echo "Deployment script: $APP_DIR/deploy.sh"
echo "Health check script: $APP_DIR/health-check.sh"

# Final status check
echo "=== Service Status ==="
systemctl status nginx --no-pager -l
systemctl status amazon-cloudwatch-agent --no-pager -l
if systemctl is-active --quiet $APP_NAME; then
    systemctl status $APP_NAME --no-pager -l
    pm2 list
else
    echo "$APP_NAME service is not running (normal if no code deployed yet)"
fi

echo "=== Disk Usage ==="
df -h

echo "=== Memory Usage ==="
free -h

echo "Setup completed successfully!"
EOF
