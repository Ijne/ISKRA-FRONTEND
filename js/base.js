async function getCurrentUser() {
    try {
        const decodedString = decodeURIComponent(initDataString);
        
        const params = new URLSearchParams(decodedString);
        const receivedHash = params.get('hash');
        
        if (!receivedHash) {
            console.error('Hash not found in init data');
            return 1;
        }
        
        params.delete('hash');
        
        const dataPairs = [];
        for (const [key, value] of params) {
            dataPairs.push(`${key}=${value}`);
        }
        dataPairs.sort();
        
        const dataCheckString = dataPairs.join('\n');
        
        const encoder = new TextEncoder();
        const secretKeyMaterial = encoder.encode('WebAppData' + botToken);
        
        const key = await crypto.subtle.importKey(
            'raw',
            secretKeyMaterial,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const dataBuffer = encoder.encode(dataCheckString);
        const signature = await crypto.subtle.sign('HMAC', key, dataBuffer);
        
        const calculatedHash = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        if (calculatedHash === receivedHash) {
            const userParam = params.get('user');
            if (userParam) {
                const userData = JSON.parse(userParam);
                return userData.id || null;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Validation error:', error);
        return 1;
    }
}

function setupNavigation() {
    const profileButton = document.querySelector('.nav-button:nth-child(1)');
    const mainButton = document.querySelector('.main-button');
    const eventsButton = document.querySelector('.nav-button:nth-child(3)');

    if (profileButton) {
        profileButton.addEventListener('click', function() {
            window.location.href = 'profile.html';
        });
    }
    
    if (mainButton) {
        mainButton.addEventListener('click', function() {
            window.location.href = 'index.html';
        });
    }
    
    if (eventsButton) {
        eventsButton.addEventListener('click', function() {
            window.location.href = 'events.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setupNavigation();
});