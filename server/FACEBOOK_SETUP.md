# Required Environment Variables for Facebook Integration

Add these to your .env file:

```
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
APP_URL=http://localhost:5000
```

Steps to set up Facebook App:
1. Go to https://developers.facebook.com
2. Create a new app or use an existing one
3. Add Facebook Login product
4. Set OAuth redirect URI to: http://localhost:5000/api/facebook/callback
5. Add required permissions in App Review:
   - email
   - pages_show_list
   - pages_read_engagement
   - pages_manage_posts
   - pages_messaging
   - public_profile

Note: For production, update APP_URL to your live domain.