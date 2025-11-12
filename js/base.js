const crypto = require('crypto');

function getCurrentUser() {
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
        
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();
        
        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        
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