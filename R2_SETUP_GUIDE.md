# Cloudflare R2 Cloud Storage Setup Guide

Complete guide to enable cloud file uploads in your Electron S3 application using Cloudflare R2.

## Why Cloudflare R2?

✅ **Zero egress fees** - No charges for downloads (vs $90/TB on AWS S3)
✅ **10GB free tier** - Permanently free storage
✅ **S3-compatible** - Works with existing S3 code
✅ **Global performance** - 330+ cities worldwide
✅ **Simple pricing** - $15/TB storage + operations

---

## Step 1: Create Cloudflare R2 Account (5-10 minutes)

### 1.1 Sign Up for Cloudflare

1. Go to https://dash.cloudflare.com/sign-up
2. Create free account (no credit card required for 10GB tier)
3. Verify your email address

### 1.2 Navigate to R2 Object Storage

1. Log in to Cloudflare Dashboard
2. Click **R2** in left sidebar
3. Click **Create bucket**

### 1.3 Create Your Bucket

1. **Bucket name**: `electron-app-storage` (or your preferred name)
2. **Location**: Choose "Automatic" (closest to you)
3. Click **Create bucket**

✅ **Bucket created!** You should see it in your R2 dashboard.

---

## Step 2: Generate API Tokens (3-5 minutes)

### 2.1 Navigate to API Tokens

1. In R2 dashboard, click **Manage R2 API Tokens**
2. Click **Create API token**

### 2.2 Configure Token Permissions

1. **Token name**: `electron-app-cloud-storage`
2. **Permissions**: Select **Object Read & Write**
3. **Specify bucket**: Select your bucket (`electron-app-storage`)
4. Click **Create API token**

### 2.3 Save Your Credentials

⚠️ **IMPORTANT**: These are shown only once! Save them immediately.

You'll see three credentials:
```
Account ID: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Access Key ID: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Secret Access Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Copy all three** to a secure location (password manager recommended).

---

## Step 3: Configure CORS Policy (2 minutes)

CORS is required for browser-based uploads from Electron.

### 3.1 Go to Bucket Settings

1. Click your bucket name (`electron-app-storage`)
2. Click **Settings** tab
3. Scroll to **CORS Policy**

### 3.2 Add CORS Rule

Click **Add CORS rule** and paste:

```json
{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["GET", "PUT", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag", "Content-Length"],
  "MaxAgeSeconds": 3600
}
```

Click **Save**.

✅ **CORS configured!** Your bucket can now accept uploads from Electron.

---

## Step 4: Configure Environment Variables

### 4.1 Create `.env` File

In your project root (where `s3-component.js` is located), create a file named `.env`:

```bash
# Cloudflare R2 Cloud Storage Configuration
R2_ACCOUNT_ID=your_cloudflare_account_id_here
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_BUCKET_NAME=electron-app-storage

# Feature Flags
CLOUD_STORAGE_ENABLED=true
CLOUD_STORAGE_FALLBACK_TO_LOCAL=true
```

### 4.2 Paste Your Credentials

Replace the placeholder values with your actual credentials from Step 2.3:

- `R2_ACCOUNT_ID` → Your Account ID
- `R2_ACCESS_KEY_ID` → Your Access Key ID
- `R2_SECRET_ACCESS_KEY` → Your Secret Access Key
- `R2_BUCKET_NAME` → Your bucket name (default: `electron-app-storage`)

### 4.3 Verify `.gitignore`

Make sure `.env` is in your `.gitignore` file (it already is):

```gitignore
.env*.local
.env
```

⚠️ **Never commit `.env` to version control!**

---

## Step 5: Test Cloud Upload

### 5.1 Start the Application

```bash
node s3-component.js
```

### 5.2 Upload a Large File

1. Click **Upload something**
2. Select a file **>5MB** (this will trigger cloud storage)
3. Watch the progress indicator

You should see:
```
Uploading to cloud storage ☁️...
```

### 5.3 Verify Upload

**Check R2 Dashboard:**
1. Go to Cloudflare R2 → Your bucket
2. You should see the uploaded file

**Check App:**
1. File should have `cloud` badge
2. Download should work via presigned URL

---

## Step 6: Migrate Existing Files (Optional)

If you have existing local files >5MB that you want to move to cloud:

1. Click **☁️ Migrate to Cloud** button
2. Review list of files to migrate
3. Click **OK** to confirm
4. Wait for migration to complete

**Note**: Current implementation requires backend support for full migration. Files are marked for cloud storage.

---

## Troubleshooting

### Issue: "Cloud storage not available"

**Solution**: Check environment variables are loaded correctly.

```bash
# Verify .env file exists
ls -la .env

# Check file contents (sensitive data masked)
cat .env | grep R2_ACCOUNT_ID
```

### Issue: "Failed to upload file to cloud storage: 403"

**Solution**: Check API token permissions.

1. Go to R2 → Manage R2 API Tokens
2. Verify token has **Object Read & Write** permissions
3. Verify token is scoped to correct bucket
4. Regenerate token if needed

### Issue: "CORS policy error"

**Solution**: Verify CORS configuration.

1. Go to bucket → Settings → CORS Policy
2. Ensure `AllowedMethods` includes `PUT`
3. Ensure `AllowedOrigins` includes `*` or your app origin

### Issue: Files still uploading to local storage

**Solution**: Check file size threshold.

- Files **≤5MB** → local storage (by design)
- Files **>5MB** → cloud storage

To change threshold, update in s3-component.js:
```javascript
const storageType = file.size > 5 * 1024 * 1024 ? 'cloud' : 'local';
```

---

## Cost Monitoring

### Free Tier Limits

- **Storage**: 10 GB/month
- **Class A Operations** (writes): 1 million/month
- **Class B Operations** (reads): 10 million/month

### Pricing Beyond Free Tier

- **Storage**: $0.015/GB/month ($15/TB)
- **Class A Operations**: $4.50/million
- **Class B Operations**: $0.36/million
- **Egress**: $0 (FREE - no download fees!)

### Monitor Usage

1. Go to Cloudflare R2 Dashboard
2. Click **Metrics**
3. View storage and operations usage

Set up billing alerts:
1. Dashboard → Billing → Notifications
2. Set threshold (e.g., $5/month)
3. Get email alerts when exceeded

---

## Security Best Practices

### 1. Rotate API Tokens Quarterly

```bash
# 1. Generate new token in Cloudflare dashboard
# 2. Update .env with new credentials
# 3. Restart application
# 4. Delete old token in dashboard
```

### 2. Use Least Privilege

- Only grant **Object Read & Write** (not Admin)
- Scope tokens to specific bucket
- Create separate tokens for dev/prod

### 3. Monitor Access

- Review R2 logs monthly
- Check for unusual upload/download patterns
- Set up Cloudflare WAF rules for additional protection

### 4. Enable Encryption

R2 automatically encrypts data at rest (AES-256).

For additional security, consider client-side encryption before upload.

---

## Next Steps

✅ **Cloud storage configured!**

Now you can:

1. **Upload large files** (>5MB) to cloud automatically
2. **Download via presigned URLs** (zero egress fees)
3. **Migrate existing files** using the migration tool
4. **Monitor usage** in Cloudflare dashboard

### Advanced Configuration

**Custom File Size Threshold:**

Edit `s3-component.js` line ~1354:
```javascript
const storageType = file.size > 10 * 1024 * 1024 ? 'cloud' : 'local'; // 10MB threshold
```

**Disable Automatic Fallback:**

In `.env`:
```bash
CLOUD_STORAGE_FALLBACK_TO_LOCAL=false  # Errors instead of falling back
```

**Custom Bucket Name:**

In `.env`:
```bash
R2_BUCKET_NAME=my-custom-bucket-name
```

---

## Support

### Documentation

- **Cloudflare R2 Docs**: https://developers.cloudflare.com/r2/
- **AWS SDK v3 Docs**: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/
- **S3 API Reference**: https://docs.aws.amazon.com/AmazonS3/latest/API/

### Common Questions

**Q: Can I use AWS S3 instead of R2?**
A: Yes! The code uses AWS SDK and is S3-compatible. Just update credentials and endpoint in R2Service.ts.

**Q: What happens if R2 is down?**
A: With `CLOUD_STORAGE_FALLBACK_TO_LOCAL=true`, files automatically save locally. No data loss.

**Q: Can I delete files from R2?**
A: Yes! Click the delete button on cloud files. They'll be removed from both R2 and database.

**Q: How do I backup my R2 data?**
A: Use Cloudflare's built-in export or AWS CLI:
```bash
aws s3 sync s3://electron-app-storage ./backup --endpoint-url=https://...
```

---

## Summary Checklist

- [ ] Cloudflare account created
- [ ] R2 bucket created (`electron-app-storage`)
- [ ] API tokens generated and saved securely
- [ ] CORS policy configured
- [ ] `.env` file created with credentials
- [ ] Environment variables verified
- [ ] Cloud upload tested with >5MB file
- [ ] Download tested via presigned URL
- [ ] Existing files migrated (optional)
- [ ] Usage monitoring set up

**Congratulations! 🎉** Your Electron app now has cloud storage with zero egress fees!