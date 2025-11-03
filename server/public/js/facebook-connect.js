async function connectFacebook() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Please log in first');
        }

        // Get the auth URL from backend
        const response = await fetch(`${API_URL}/facebook/connect`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const data = await response.text();
            throw new Error(data || 'Failed to start Facebook connection');
        }

        const { authUrl } = await response.json();
        
        // Open Facebook OAuth popup
        const width = 600;
        const height = 600;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        const popup = window.open(
            authUrl,
            'facebook_connect',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
            throw new Error('Popup was blocked. Please allow popups and try again.');
        }

        // Listen for the popup response
        const connectPromise = new Promise((resolve, reject) => {
            window.addEventListener('message', function handler(event) {
                if (event.data.type === 'FACEBOOK_CONNECTED') {
                    window.removeEventListener('message', handler);
                    if (event.data.success) {
                        resolve(event.data);
                    } else {
                        reject(new Error(event.data.error || 'Failed to connect Facebook'));
                    }
                }
            });

            // Check if popup was closed
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    reject(new Error('Connection window was closed'));
                }
            }, 1000);
        });

        const result = await connectPromise;
        alert('Facebook connected successfully! You earned 100 points!');
        // Refresh dashboard to show updated points
        showDashboard();
        
    } catch (error) {
        console.error('Facebook connect error:', error);
        alert(error.message || 'Error connecting to Facebook');
    }
}