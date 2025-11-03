const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.get('/connect', auth, async (req, res) => {
    try {
        // Check if Facebook is configured
        if (!process.env.FACEBOOK_APP_ID) {
            throw new Error('Facebook App ID not configured');
        }

        // Generate the Facebook login URL
        const redirectUri = encodeURIComponent(`${process.env.APP_URL}/api/facebook/callback`);
        const scope = encodeURIComponent('email,public_profile');
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
            `client_id=${process.env.FACEBOOK_APP_ID}&` +
            `redirect_uri=${redirectUri}&` +
            `scope=${scope}&` +
            `response_type=code`;

        res.json({ authUrl });
    } catch (error) {
        console.error('Facebook connect error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/callback', async (req, res) => {
    try {
        const { code, error } = req.query;

        if (error) {
            return res.send(`
                <script>
                    window.opener.postMessage({ 
                        type: 'FACEBOOK_CONNECTED',
                        success: false,
                        error: '${error}'
                    }, '*');
                    window.close();
                </script>
            `);
        }

        if (!code) {
            throw new Error('No authorization code received');
        }

        // Here you would exchange the code for an access token
        // For now, we'll simulate success
        res.send(`
            <script>
                window.opener.postMessage({ 
                    type: 'FACEBOOK_CONNECTED',
                    success: true 
                }, '*');
                window.close();
            </script>
        `);
    } catch (error) {
        console.error('Facebook callback error:', error);
        res.send(`
            <script>
                window.opener.postMessage({ 
                    type: 'FACEBOOK_CONNECTED',
                    success: false,
                    error: '${error.message}'
                }, '*');
                window.close();
            </script>
        `);
    }
});

module.exports = router;