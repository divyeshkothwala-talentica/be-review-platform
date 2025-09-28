# Workflow Fix for Existing Infrastructure

## 🎯 Problem
The current workflow tries to download `terraform-outputs-prod` artifact which doesn't exist because your infrastructure was deployed separately.

## ✅ Solution
Replace the artifact download with direct AWS API calls to find your existing EC2 instance.

## 🔧 Required Changes

### 1. Replace the Download Artifact Step
**Find this section (around line 254-259):**
```yaml
      - name: Download Terraform outputs
        uses: actions/download-artifact@v4
        with:
          name: terraform-outputs-prod
          path: terraform/environments/prod/
        continue-on-error: true
```

**Replace with:**
```yaml
      - name: Find existing EC2 instance
        id: find-instance
        run: |
          echo "🔍 Finding existing EC2 instance for production..."
          
          # Find EC2 instance by tag or name pattern
          INSTANCE_INFO=$(aws ec2 describe-instances \
            --filters "Name=instance-state-name,Values=running" \
                      "Name=tag:Environment,Values=prod" \
                      "Name=tag:Project,Values=book-review-platform" \
            --query 'Reservations[0].Instances[0].[InstanceId,PublicIpAddress]' \
            --output text 2>/dev/null || echo "")
          
          if [ -z "$INSTANCE_INFO" ] || [ "$INSTANCE_INFO" = "None None" ]; then
            echo "❌ No running production instance found with tags"
            echo "Trying to find by instance type and key pair..."
            
            # Fallback: find by instance type and key pair
            INSTANCE_INFO=$(aws ec2 describe-instances \
              --filters "Name=instance-state-name,Values=running" \
                        "Name=instance-type,Values=t3.medium" \
                        "Name=key-name,Values=review-platform-backend-key" \
              --query 'Reservations[0].Instances[0].[InstanceId,PublicIpAddress]' \
              --output text 2>/dev/null || echo "")
          fi
          
          if [ -z "$INSTANCE_INFO" ] || [ "$INSTANCE_INFO" = "None None" ]; then
            echo "❌ No suitable EC2 instance found!"
            echo ""
            echo "🔍 Available instances:"
            aws ec2 describe-instances \
              --filters "Name=instance-state-name,Values=running" \
              --query 'Reservations[].Instances[].[InstanceId,PublicIpAddress,InstanceType,KeyName,Tags[?Key==`Name`].Value|[0]]' \
              --output table
            echo ""
            echo "💡 Please ensure your EC2 instance has these tags:"
            echo "  - Environment: prod"
            echo "  - Project: book-review-platform"
            echo ""
            echo "Or update the filters above to match your instance."
            exit 1
          fi
          
          INSTANCE_ID=$(echo $INSTANCE_INFO | cut -d' ' -f1)
          INSTANCE_IP=$(echo $INSTANCE_INFO | cut -d' ' -f2)
          
          echo "✅ Found instance: $INSTANCE_ID"
          echo "✅ Public IP: $INSTANCE_IP"
          
          echo "instance_id=$INSTANCE_ID" >> $GITHUB_OUTPUT
          echo "instance_ip=$INSTANCE_IP" >> $GITHUB_OUTPUT
```

### 2. Update Instance Information Step
**Find this section (around line 261-270):**
```yaml
      - name: Get instance information
        id: instance
        run: |
          if [ -f terraform/environments/prod/terraform-outputs.json ]; then
            INSTANCE_IP=$(jq -r '.instance_public_ip.value' terraform/environments/prod/terraform-outputs.json)
            echo "instance_ip=$INSTANCE_IP" >> $GITHUB_OUTPUT
          else
            echo "Terraform outputs not found. Please run infrastructure deployment first."
            exit 1
          fi
```

**Replace with:**
```yaml
      - name: Verify instance information
        id: instance
        run: |
          INSTANCE_IP="${{ steps.find-instance.outputs.instance_ip }}"
          INSTANCE_ID="${{ steps.find-instance.outputs.instance_id }}"
          
          echo "🔍 Verifying instance accessibility..."
          echo "Instance ID: $INSTANCE_ID"
          echo "Instance IP: $INSTANCE_IP"
          
          # Verify instance is reachable
          if ping -c 1 -W 5 $INSTANCE_IP > /dev/null 2>&1; then
            echo "✅ Instance is reachable via ping"
          else
            echo "⚠️  Instance not reachable via ping (may be normal if ICMP is blocked)"
          fi
          
          echo "instance_ip=$INSTANCE_IP" >> $GITHUB_OUTPUT
          echo "instance_id=$INSTANCE_ID" >> $GITHUB_OUTPUT
```

## 🏷️ Alternative: Use Hardcoded IP (Quick Fix)

If you want a quick fix, you can hardcode your instance IP:

```yaml
      - name: Set instance information
        id: instance
        run: |
          # Hardcoded IP for existing infrastructure
          INSTANCE_IP="44.194.207.22"
          echo "instance_ip=$INSTANCE_IP" >> $GITHUB_OUTPUT
          echo "✅ Using existing instance: $INSTANCE_IP"
```

## 🎯 Recommended Approach

Use the **AWS API approach** (first option) because:
- ✅ Automatically finds your instance
- ✅ Works even if IP changes
- ✅ More robust and maintainable
- ✅ Can find instance by tags or characteristics

## 📋 Next Steps

1. Edit `.github/workflows/deploy-application.yml`
2. Apply the changes above
3. Commit and push
4. Test the deployment

The workflow will now work with your existing infrastructure! 🚀
