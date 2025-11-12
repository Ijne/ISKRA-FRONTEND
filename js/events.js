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

const API_BASE_URL = 'http://localhost:8080'

let currentEvents = [];
let currentFlames = [];
let selectedEventId = null;


document.addEventListener('DOMContentLoaded', function() {
    loadEvents();
    setupNavigation();
});


async function loadEvents() {
    try {
        const response = await fetch(`${API_BASE_URL}/events`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при загрузке мероприятий');
        }

        const data = await response.json();
        
        if (data.status === 'ok') {
            currentEvents = data.events || [];
            displayEvents(currentEvents);
        } else {
            throw new Error(data.error || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка загрузки мероприятий:', error);
        showMessage('Не удалось загрузить мероприятия', 'error');
    }
}


function displayEvents(events) {
    const eventsList = document.getElementById('eventsList');
    
    if (!events || events.length === 0) {
        eventsList.innerHTML = `
            <div class="no-events">
                Пока нет доступных мероприятий
            </div>
        `;
        return;
    }

    eventsList.innerHTML = events.map(event => `
        <div class="event-card" onclick="openFlamesModal(${event.ID})">
            ${event.Photo ? 
                `<img src="${event.Photo}" alt="${event.Name}" class="event-photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                ''
            }
            <div class="event-photo-placeholder" ${event.Photo ? 'style="display: none;"' : ''}>
                🎭
            </div>
            <h3 class="event-name">${escapeHtml(event.Name)}</h3>
            <div class="event-date">${formatDate(event.StartsAt)}</div>
            <div class="event-url">${event.Url}</div>
        </div>
    `).join('');
}


async function openFlamesModal(eventId) {
    selectedEventId = eventId;
    
    const event = currentEvents.find(e => e.ID === eventId);
    if (event) {
        document.getElementById('modalEventTitle').textContent = event.Name;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/flames`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ event_id: eventId })
        });

        if (!response.ok) {
            throw new Error('Ошибка при загрузке лобби');
        }

        const data = await response.json();
        
        if (data.status === 'ok') {
            currentFlames = data.flames || [];
            displayFlames(currentFlames);
            document.getElementById('flamesModal').style.display = 'flex';
        } else {
            throw new Error(data.error || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка загрузки лобби:', error);
        showMessage('Не удалось загрузить лобби', 'error');
    }
}


function closeFlamesModal() {
    document.getElementById('flamesModal').style.display = 'none';
    selectedEventId = null;
    currentFlames = [];
}


function displayFlames(flames) {
    const flamesList = document.getElementById('flamesList');
    const currentUserId = getCurrentUser();
    
    if (!flames || flames.length === 0) {
        flamesList.innerHTML = `
            <div class="no-flames">
                <div class="no-flames-icon">🔥</div>
                <div class="no-flames-text">Пока нет лобби для этого мероприятия</div>
                <button class="create-flame-btn-inline" onclick="openCreateFlameModal()">
                    Создать первое лобби
                </button>
            </div>
        `;
        return;
    }

    flamesList.innerHTML = flames.map(flame => {
        const isOwnFlame = flame.user_id === currentUserId;
        const userInitials = getInitials(flame.name, flame.surname);
        
        return `
            <div class="flame-card ${isOwnFlame ? 'own-flame' : ''}">
                <div class="flame-header">
                    <div class="flame-user">
                        <div class="flame-avatar">${userInitials}</div>
                        <div class="flame-user-info">
                            <div class="flame-username">${flame.username || 'Пользователь'}</div>
                            <div class="flame-user-details">
                                ${flame.age ? flame.age + ' лет' : ''} 
                                ${flame.gender !== undefined ? (flame.gender === 0 ? '♂' : '♀') : ''}
                            </div>
                        </div>
                    </div>
                    ${!isOwnFlame ? `
                        <button class="like-btn" onclick="likeUser(${flame.user_id}, this)">
                            ❤️ Лайк
                        </button>
                    ` : ''}
                </div>
                <div class="flame-description">
                    ${escapeHtml(flame.description || 'Без описания')}
                </div>
            </div>
        `;
    }).join('');
}


async function likeUser(userId, button) {
    try {
        const response = await fetch(`${API_BASE_URL}/like-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ light_id: userId })
        });

        if (!response.ok) {
            throw new Error('Ошибка при отправке лайка');
        }

        const data = await response.json();
        
        if (data.status === 'ok') {
            button.classList.add('liked');
            button.innerHTML = '❤️ Лайк отправлен!';
            button.disabled = true;
            
            setTimeout(() => {
                button.style.opacity = '0.7';
            }, 1000);
            
            console.log('Лайк успешно отправлен пользователю:', userId);
        } else {
            throw new Error(data.error || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка отправки лайка:', error);
        showMessage('Не удалось отправить лайк', 'error');
    }
}


function openCreateFlameModal() {
    document.getElementById('createFlameModal').style.display = 'flex';
    document.getElementById('flameDescription').value = '';
}


function closeCreateFlameModal() {
    document.getElementById('createFlameModal').style.display = 'none';
}


async function createFlame() {
    const description = document.getElementById('flameDescription').value.trim();
    
    if (!description) {
        showMessage('Введите описание лобби', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/flame`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_id: selectedEventId,
                description: description
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка при создании лобби');
        }

        const data = await response.json();
        
        if (data.status === 'ok') {
            closeCreateFlameModal();
            console.log('Лобби успешно создано для мероприятия:', selectedEventId);
            
            
            setTimeout(() => {
                openFlamesModal(selectedEventId);
            }, 500);
        } else {
            throw new Error(data.error || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка создания лобби:', error);
        showMessage('Не удалось создать лобби', 'error');
    }
}


function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name, surname) {
    const first = name ? name[0] : 'П';
    const second = surname ? surname[0] : 'У';
    return (first + second).toUpperCase();
}

function showMessage(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
}


function setupNavigation() {
    const profileButton = document.querySelector('.nav-button:nth-child(1)');
    const mainButton = document.querySelector('.main-button');
    
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
}


document.addEventListener('click', function(event) {
    const flamesModal = document.getElementById('flamesModal');
    const createFlameModal = document.getElementById('createFlameModal');
    
    if (event.target === flamesModal) {
        closeFlamesModal();
    }
    
    if (event.target === createFlameModal) {
        closeCreateFlameModal();
    }
});