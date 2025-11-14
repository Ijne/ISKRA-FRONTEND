const API_BASE_URL = 'http://localhost:8080';

let currentEvents = [];
let currentFlames = [];
let selectedEventId = null;
let userCity = '';
let currentSkip = 0;
const limit = 5;
let isLoading = false;
let hasMoreEvents = true;
let initData = null;
let WebApp = null;

// Универсальная функция ожидания загрузки WebApp
function waitForWebApp() {
    return new Promise((resolve) => {
        if (window.WebApp?.initData) {
            WebApp = window.WebApp;
            initData = window.WebApp?.initData;
            console.log('WebApp загружен:', WebApp);
            resolve();
            return;
        }

        let attempts = 0;
        const maxAttempts = 50;
        
        const check = () => {
            attempts++;
            if (window.WebApp) {
                WebApp = window.WebApp;
                initData = window.WebApp?.initData;
                console.log('WebApp загружен:', WebApp);
                console.log('InitData:', initData);
                resolve();
            } else if (attempts < maxAttempts) {
                setTimeout(check, 100);
            } else {
                console.warn('WebApp не загрузился, продолжаем без него');
                resolve();
            }
        };
        
        check();
    });
}

// Универсальная функция получения ID пользователя
async function getCurrentUser() {
    try {
        await waitForWebApp();
        
        if (!initData) {
            console.error('No init data found');
            return null;
        }

        console.log('InitData type:', typeof initData, initData);
        
        // Если initData уже объект (новый формат Telegram Web App)
        if (typeof initData === 'object') {
            const user = initData.user || initData;
            const userId = user.id || null;
            console.log('User ID from object:', userId);
            return userId;
        }

        // Если initData строка (старый формат)
        if (typeof initData === 'string') {
            const decodedString = decodeURIComponent(initData);
            const params = new URLSearchParams(decodedString);
            
            console.log('Parsed params:', Object.fromEntries(params));
            
            // Пробуем получить user параметр напрямую
            const userParam = params.get('user');
            if (userParam) {
                try {
                    const userData = JSON.parse(userParam);
                    const userId = userData.id || null;
                    console.log('User ID from user param:', userId);
                    if (userId) return userId;
                } catch (e) {
                    console.error('Error parsing user data:', e);
                }
            }
            
            // Если не нашли в user параметре, пробуем другие варианты
            const userIdParam = params.get('id') || params.get('user_id') || params.get('userId');
            if (userIdParam) {
                console.log('User ID from direct param:', userIdParam);
                return parseInt(userIdParam) || userIdParam;
            }
            
            // Если есть hash, пробуем валидацию
            const receivedHash = params.get('hash');
            if (receivedHash) {
                console.log('Attempting hash validation...');
                const isValid = await validateInitData(decodedString, receivedHash);
                if (isValid && userParam) {
                    try {
                        const userData = JSON.parse(userParam);
                        const userId = userData.id || null;
                        console.log('User ID after hash validation:', userId);
                        return userId;
                    } catch (parseError) {
                        console.error('Error parsing user data after validation:', parseError);
                    }
                }
            }
            
            // Если ничего не помогло, возвращаем null
            console.log('No user ID found in init data');
            return null;
        }
        
        return null;
    } catch (error) {
        console.error('Error in getCurrentUser:', error);
        return null;
    }
}

// Функция валидации init data (опционально, можно отключить если не работает)
async function validateInitData(decodedString, receivedHash) {
    try {
        const params = new URLSearchParams(decodedString);
        const userParam = params.get('user');
        
        const dataPairs = [];
        for (const [key, value] of params) {
            if (key !== 'hash') {
                dataPairs.push(`${key}=${value}`);
            }
        }
        dataPairs.sort();
        
        const dataCheckString = dataPairs.join('\n');
        console.log('Data check string:', dataCheckString);

        const botToken = 'f9LHodD0cOLRQi29OdyXpiSqLM-SyPUJnePMbZQH3ceilC7cKmf12ib4C7Oeda975ZN_gzuX6fJmQVKE5j1e';
        
        const encoder = new TextEncoder();

        const secretKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode('WebAppData'),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const cryptoKey = await crypto.subtle.sign(
            'HMAC',
            secretKey,
            encoder.encode(botToken)
        );

        const hmacKey = await crypto.subtle.importKey(
            'raw',
            cryptoKey,
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
        
        console.log('Hash validation - calculated:', calculatedHash);
        console.log('Hash validation - received:', receivedHash);

        const isValid = calculatedHash === receivedHash;
        console.log('Hash validation result:', isValid);
        
        return isValid;
    } catch (error) {
        console.error('Error in hash validation:', error);
        return false;
    }
}

async function initApp() {
    try {
        await waitForWebApp();
        console.log('Приложение инициализировано');
        
        setupNavigation();
        setupInfiniteScroll();
        
        await loadEvents();
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        setupNavigation();
        setupInfiniteScroll();
    }
}

document.addEventListener('DOMContentLoaded', initApp);

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (isLoading || !hasMoreEvents) return;

        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            loadMoreEvents();
        }
    });
}

// Загрузка мероприятий
async function loadEvents() {
    try {
        const userId = await getCurrentUser();
        console.log(`GET events userId: ${userId}`)
        const url = userId ? `${API_BASE_URL}/events?id=${userId}` : `${API_BASE_URL}/events`;
        
        console.log('Загрузка мероприятий...');
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'ok') {
            currentEvents = data.events || [];
            console.log(`Загружено мероприятий: ${currentEvents.length}`);
            displayEvents(currentEvents);
            
            await loadMoreEvents();
            
        } else {
            throw new Error(data.error || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка загрузки мероприятий:', error);
        showMessage('Не удалось загрузить мероприятия', 'error');
        await loadMoreEvents();
    }
}

async function loadEvents() {
    try {
        const userId = await getCurrentUser();
        const url = userId ? `${API_BASE_URL}/events?id=${userId}` : `${API_BASE_URL}/events`;
        
        console.log('Загрузка мероприятий... URL:', url);
        
        // Добавляем timeout для запроса
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд timeout
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'ok') {
            currentEvents = data.events || [];
            console.log(`Загружено мероприятий: ${currentEvents.length}`);
            displayEvents(currentEvents);
            
            await loadMoreEvents();
        } else {
            throw new Error(data.error || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка загрузки мероприятий:', error);
        // Показываем сообщение об ошибке вместо бесконечной загрузки
        const eventsList = document.getElementById('eventsList');
        if (eventsList) {
            eventsList.innerHTML = `
                <div class="error-message">
                    Не удалось загрузить мероприятия. Проверьте подключение к серверу.
                </div>
            `;
        }
        showMessage('Не удалось загрузить мероприятия', 'error');
    }
}

// Отображение мероприятий
function displayEvents(events) {
    const eventsList = document.getElementById('eventsList');
    
    if (!eventsList) {
        console.error('Элемент eventsList не найден');
        return;
    }
    
    // Удаляем индикаторы загрузки если они есть
    const existingIndicators = eventsList.querySelectorAll('.loading-indicator, .no-more-events');
    existingIndicators.forEach(indicator => indicator.remove());
    
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
            <div class="event-url">
                <a href="${event.Url}" target="_blank" onclick="event.stopPropagation()">
                    ${event.Url}
                </a>
            </div>
        </div>
    `).join('');
    
    // Добавляем индикатор загрузки если есть еще события
    if (hasMoreEvents) {
        eventsList.innerHTML += `<div class="loading-indicator">Загрузка...</div>`;
    }
}

// Показать индикатор загрузки
function showLoadingIndicator() {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;
    
    const existingIndicator = eventsList.querySelector('.loading-indicator');
    if (!existingIndicator) {
        eventsList.innerHTML += `<div class="loading-indicator">Загрузка...</div>`;
    }
}

// Скрыть индикатор загрузки
function hideLoadingIndicator() {
    const indicator = document.querySelector('.loading-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Показать сообщение о том, что события закончились
function showNoMoreEvents() {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;
    
    const existingMessage = eventsList.querySelector('.no-more-events');
    if (!existingMessage) {
        eventsList.innerHTML += `
            <div class="no-more-events">
                Все мероприятия загружены
            </div>
        `;
    }
}

// Открытие модального окна с лобби
async function openFlamesModal(eventId) {
    try {
        selectedEventId = eventId;
        
        const event = currentEvents.find(e => e.ID === eventId);
        if (event) {
            const modalEventTitle = document.getElementById('modalEventTitle');
            if (modalEventTitle) {
                modalEventTitle.textContent = event.Name;
            }
        }
        
        const userId = await getCurrentUser();
        const url = userId ? `${API_BASE_URL}/flames?id=${userId}` : `${API_BASE_URL}/flames`;
        
        console.log('Загрузка лобби для мероприятия:', eventId);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ event_id: eventId })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'ok') {
            currentFlames = data.flames || [];
            console.log(`Загружено лобби: ${currentFlames.length}`);
            await displayFlames(currentFlames);
            
            const flamesModal = document.getElementById('flamesModal');
            if (flamesModal) {
                flamesModal.style.display = 'flex';
            }
        } else {
            throw new Error(data.error || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка загрузки лобби:', error);
        showMessage('Не удалось загрузить лобби', 'error');
    }
}

// Закрытие модального окна лобби
function closeFlamesModal() {
    const flamesModal = document.getElementById('flamesModal');
    if (flamesModal) {
        flamesModal.style.display = 'none';
    }
    selectedEventId = null;
    currentFlames = [];
}

// Отображение лобби
async function displayFlames(flames) {
    const flamesList = document.getElementById('flamesList');
    if (!flamesList) {
        console.error('Элемент flamesList не найден');
        return;
    }
    
    const currentUserId = await getCurrentUser();
    console.log('Текущий пользователь ID:', currentUserId);
    
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
        const isOwnFlame = flame.user_id == currentUserId;
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

// Лайк пользователя
async function likeUser(userId, button) {
    try {
        const currentUserId = await getCurrentUser();
        if (!currentUserId) {
            showMessage('Необходимо авторизоваться', 'error');
            return;
        }

        console.log('Отправка лайка пользователю:', userId);
        const response = await fetch(`${API_BASE_URL}/like-user?id=${currentUserId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ light_id: userId })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'ok') {
            if (button) {
                button.classList.add('liked');
                button.innerHTML = '❤️ Лайк отправлен!';
                button.disabled = true;
                
                setTimeout(() => {
                    button.style.opacity = '0.7';
                }, 1000);
            }
            
            console.log('Лайк успешно отправлен пользователю:', userId);
        } else {
            throw new Error(data.error || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка отправки лайка:', error);
        showMessage('Не удалось отправить лайк', 'error');
    }
}

// Открытие модального окна создания лобби
function openCreateFlameModal() {
    const createFlameModal = document.getElementById('createFlameModal');
    const flameDescription = document.getElementById('flameDescription');
    
    if (createFlameModal) {
        createFlameModal.style.display = 'flex';
    }
    
    if (flameDescription) {
        flameDescription.value = '';
    }
}

// Закрытие модального окна создания лобби
function closeCreateFlameModal() {
    const createFlameModal = document.getElementById('createFlameModal');
    if (createFlameModal) {
        createFlameModal.style.display = 'none';
    }
}

// Создание лобби
async function createFlame() {
    const flameDescription = document.getElementById('flameDescription');
    if (!flameDescription) {
        showMessage('Элемент описания не найден', 'error');
        return;
    }
    
    const description = flameDescription.value.trim();
    
    if (!description) {
        showMessage('Введите описание лобби', 'error');
        return;
    }

    try {
        const userId = await getCurrentUser();
        if (!userId) {
            showMessage('Необходимо авторизоваться', 'error');
            return;
        }

        console.log('Создание лобби для мероприятия:', selectedEventId);
        const response = await fetch(`${API_BASE_URL}/flame?id=${userId}`, {
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
            throw new Error(`HTTP error! status: ${response.status}`);
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

// Вспомогательные функции
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Ошибка форматирования даты:', error);
        return dateString;
    }
}

function escapeHtml(text) {
    if (!text) return '';
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

// Настройка навигации
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

// Закрытие модальных окон при клике вне их
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