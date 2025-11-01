function connectFacebook() {
    // Get OAuth URL and open popup
    const token = localStorage.getItem('token');
    fetch('/api/facebook/connect', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        const popup = window.open(data.authUrl, 'facebook-oauth', 'width=600,height=600');
        
        // Listen for connection result from popup
        window.addEventListener('message', function(event) {
            if (event.data.type === 'FACEBOOK_CONNECTED') {
                if (event.data.success) {
                    checkConnectedPlatforms();
                    showConnectedPages(event.data.pages);
                } else {
                    alert('Failed to connect Facebook: ' + (event.data.error || 'Unknown error'));
                }
            }
        }, false);
    })
    .catch(error => {
        console.error('Error initiating Facebook connection:', error);
        alert('Error connecting to Facebook');
    });
}

function showConnectedPages(pages) {
    // Create modal showing connected pages
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-lg w-full">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-semibold">Connected Facebook Pages</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            ${pages?.length ? `
                <div class="space-y-4">
                    ${pages.map(page => `
                        <div class="p-4 bg-gray-50 rounded flex justify-between items-center">
                            <div>
                                <p class="font-semibold">${page.name}</p>
                                <p class="text-sm text-gray-600">${page.category}</p>
                            </div>
                            <span class="text-green-600">
                                <i class="fas fa-check-circle"></i> Connected
                            </span>
                        </div>
                    `).join('')}
                    
                    <div class="mt-4 p-4 bg-blue-50 rounded">
                        <p class="text-sm text-blue-800">
                            <i class="fas fa-info-circle"></i>
                            Your Facebook pages are now connected. You can post updates and manage engagement directly from your dashboard.
                        </p>
                    </div>
                </div>
            ` : `
                <p class="text-gray-600">No Facebook pages found. Make sure you have admin access to the pages you want to connect.</p>
            `}
            
            <div class="mt-4 text-right">
                <button onclick="this.closest('.fixed').remove()" 
                        class="bg-blue-600 text-white px-4 py-2 rounded">
                    Done
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Add this to the checkConnectedPlatforms function
async function checkConnectedPlatforms() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/social/connected-platforms', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        // Update platform statuses
        updatePlatformStatus('facebook', data.facebook);
        // ... other platforms ...
        
        // If Facebook is connected, fetch pages
        if (data.facebook) {
            const pagesRes = await fetch('/api/facebook/pages', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const pagesData = await pagesRes.json();
            
            // Update Facebook card with page count
            const fbStatus = document.getElementById('facebookStatus');
            if (pagesData.pages?.length) {
                fbStatus.innerHTML = `
                    <span class="text-green-800">
                        <i class="fas fa-check-circle"></i>
                        ${pagesData.pages.length} Page${pagesData.pages.length > 1 ? 's' : ''}
                    </span>
                `;
            }
        }
    } catch (error) {
        console.error('Error checking platforms:', error);
    }
}