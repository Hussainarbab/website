const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const store = require('../utils/store');
const axios = require('axios');

// Store pending OAuth states
const pendingOAuth = new Map();

// Initiate Facebook OAuth
router.get('/connect', auth, (req, res) => {
    try {
        const fbAppId = process.env.FACEBOOK_APP_ID;
        if (!fbAppId) {
            throw new Error('Facebook App ID not configured');
        }
        
        const redirectUri = `${process.env.APP_URL}/api/facebook/callback`;
        if (!process.env.APP_URL) {
            throw new Error('APP_URL not configured');
        }
        
        const state = uuidv4();
        
        // Store state with user ID
        pendingOAuth.set(state, {
            userId: req.user.id || req.user._id,
            expiry: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        // Generate Facebook OAuth URL
        const scope = [
            'email',
            'pages_show_list',
            'pages_read_engagement',
            'pages_manage_posts',
            'pages_messaging',
            'public_profile'
        ].join(',');

        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
            `client_id=${fbAppId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `state=${state}&` +
            `scope=${scope}`;

        res.json({ authUrl });
    } catch (error) {
        console.error('Facebook connect error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to initialize Facebook connection'
        });
    }
    
    // Store state with user ID
    pendingOAuth.set(state, {
        userId: req.user.id || req.user._id,
        expiry: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Request necessary permissions
    const scope = [
        'email',
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'pages_messaging',
        'public_profile'
    ].join(',');

    // Generate Facebook OAuth URL
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
        `client_id=${fbAppId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}&` +
        `scope=${scope}`;

    res.json({ authUrl });
});

// Handle Facebook OAuth callback
router.get('/callback', async (req, res) => {
    try {
        const { code, error, error_description } = req.query;
        
        // Check for OAuth errors
        if (error) {
            console.error('Facebook OAuth error:', error, error_description);
            return res.send(`
                <!DOCTYPE html>
                <html>
                    <body>
                        <script>
                            window.opener.postMessage({ 
                                type: 'FACEBOOK_CONNECTED',
                                success: false,
                                error: '${error_description || error}'
                            }, '*');
                            window.close();
                        </script>
                        <p>Error: ${error_description || error}</p>
                    </body>
                </html>
            `);
        }

        if (!code) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html>
                    <body>
                        <script>
                            window.opener.postMessage({ 
                                type: 'FACEBOOK_CONNECTED',
                                success: false,
                                error: 'No authorization code received'
                            }, '*');
                            window.close();
                        </script>
                        <p>Error: No authorization code received</p>
                    </body>
                </html>
            `);
        }

        const fbAppId = process.env.FACEBOOK_APP_ID;
        const fbAppSecret = process.env.FACEBOOK_APP_SECRET;
        const redirectUri = `${process.env.APP_URL}/api/facebook/callback`;

        // Exchange code for access token
        const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
            params: {
                client_id: fbAppId,
                client_secret: fbAppSecret,
                redirect_uri: redirectUri,
                code
            }
        });

        const { access_token, expires_in } = tokenResponse.data;

        // Get user profile
        const profileResponse = await axios.get('https://graph.facebook.com/me', {
            params: {
                fields: 'id,name,email',
                access_token
            }
        });

        // Get user's Facebook pages
        const pagesResponse = await axios.get('https://graph.facebook.com/me/accounts', {
            params: { access_token }
        });

        const { id: fbUserId, name: fbName, email: fbEmail } = profileResponse.data;
        const pages = pagesResponse.data.data;

        // Get user and update their Facebook connection
        const user = await store.findById(oauthInfo.userId);
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Store Facebook credentials and page access tokens
        const updates = {
            connectedAccounts: [...new Set([...(user.connectedAccounts || []), 'facebook'])],
            facebookData: {
                userId: fbUserId,
                name: fbName,
                email: fbEmail,
                accessToken: access_token,
                tokenExpires: Date.now() + (expires_in * 1000),
                pages: pages.map(page => ({
                    id: page.id,
                    name: page.name,
                    accessToken: page.access_token,
                    category: page.category
                }))
            },
            points: (user.points || 0) + 100, // Bonus points for linking Facebook
            earnings: (user.earnings || 0) + 100
        };

        await store.updateUser(user.id || user._id, updates);
        pendingOAuth.delete(state);

        // Return success page that closes the popup and messages the parent
        res.send(`
            <!DOCTYPE html>
            <html>
                <body>
                    <script>
                        window.opener.postMessage({ 
                            type: 'FACEBOOK_CONNECTED',
                            success: true,
                            pages: ${JSON.stringify(pages)}
                        }, '*');
                        window.close();
                    </script>
                    <p>Facebook connected successfully! You can close this window.</p>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('Facebook OAuth error:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
                <body>
                    <script>
                        window.opener.postMessage({ 
                            type: 'FACEBOOK_CONNECTED', 
                            success: false,
                            error: 'Failed to connect Facebook account'
                        }, '*');
                        window.close();
                    </script>
                    <p>Error connecting Facebook. You can close this window.</p>
                </body>
            </html>
        `);
    }
});

// Get user's connected Facebook pages
router.get('/pages', auth, async (req, res) => {
    try {
        const user = await store.findById(req.user.id || req.user._id);
        if (!user?.facebookData?.pages) {
            return res.json({ pages: [] });
        }

        res.json({ pages: user.facebookData.pages });
    } catch (error) {
        console.error('Error fetching Facebook pages:', error);
        res.status(500).json({ message: 'Error fetching Facebook pages' });
    }
});

// Post to Facebook page
router.post('/post', auth, async (req, res) => {
    try {
        const { pageId, message, link } = req.body;
        const user = await store.findById(req.user.id || req.user._id);
        
        if (!user?.facebookData?.pages) {
            return res.status(400).json({ message: 'No Facebook pages connected' });
        }

        const page = user.facebookData.pages.find(p => p.id === pageId);
        if (!page) {
            return res.status(404).json({ message: 'Facebook page not found' });
        }

        // Post to Facebook page using page access token
        const response = await axios.post(
            `https://graph.facebook.com/${pageId}/feed`,
            {
                message,
                link
            },
            {
                params: { access_token: page.accessToken }
            }
        );

        res.json({ 
            success: true,
            postId: response.data.id
        });
    } catch (error) {
        console.error('Error posting to Facebook:', error);
        res.status(500).json({ message: 'Error posting to Facebook' });
    }
});

module.exports = router;