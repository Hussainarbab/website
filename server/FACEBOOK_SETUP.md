# Required Environment Variables for Facebook Integration

Add these to your .env file:

```
FACEBOOK_APP_ID=1344674834109155
FACEBOOK_APP_SECRET=31883b7aa90a9a4f506015374924b573
APP_URL=http://localhost:5001
```

Steps to set up Facebook App:
1. Go to https://developers.facebook.com
2. Create a new app or use an existing one
3. Add Facebook Login product
4. Set OAuth redirect URI to: http://localhost:5001/api/facebook/callback
5. Add required permissions in App Review:
   - email
   - pages_show_list
   - pages_read_engagement
   - pages_manage_posts
   - pages_messaging
   - public_profile

Note: For production, update APP_URL to your live domain.