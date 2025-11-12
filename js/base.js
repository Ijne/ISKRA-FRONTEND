async function getCurrentUser() {
    try {
        const initData = window.WebApp.initData || initDataString;
        if (!initData) {
            console.error('No init data found');
            return 1;
        }

        console.log('Raw initData:', initData);

        const decodedString = decodeURIComponent(initData);
        console.log('Decoded initData:', decodedString);

        const params = new URLSearchParams(decodedString);
        const receivedHash = params.get('hash');
        
        if (!receivedHash) {
            console.error('Hash not found in init data');
            return 1;
        }

        const userParam = params.get('user');
        
        params.delete('hash');
        
        const dataPairs = [];
        for (const [key, value] of params) {
            dataPairs.push(`${key}=${value}`);
        }
        dataPairs.sort();
        
        const dataCheckString = dataPairs.join('\n');
        console.log('Data check string:', dataCheckString);
        console.log('Received hash:', receivedHash);

        const encoder = new TextEncoder();
        
        const webAppKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode('WebAppData'),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const secretKey = await crypto.subtle.sign(
            'HMAC',
            webAppKey,
            encoder.encode('f9LHodD0cOLRQi29OdyXpiSqLM-SyPUJnePMbZQH3ceilC7cKmf12ib4C7Oeda975ZN_gzuX6fJmQVKE5j1e')
        );
        
        console.log('Secret key (hex):', Array.from(new Uint8Array(secretKey))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(''));

        const hmacKey = await crypto.subtle.importKey(
            'raw',
            secretKey,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign(
            'HMAC',
            hmacKey,
            encoder.encode(dataCheckString)
        );
        
        const calculatedHash = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        console.log('Calculated hash:', calculatedHash);

        if (calculatedHash === receivedHash) {
            console.log('Hash validation successful');
            
            if (userParam) {
                const userData = JSON.parse(userParam);
                console.log('User data:', userData);
                return userData.id || null;
            }
        } else {
            console.log('Hash validation failed');
            console.log('Expected:', receivedHash);
            console.log('Got:', calculatedHash);
            return null;
        }
        
        return 1;
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