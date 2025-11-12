let initData = null;
let WebApp = null;

// Ждем загрузки библиотеки Telegram WebApp
function waitForWebApp() {
    return new Promise((resolve, reject) => {
        if (window.WebApp) {
            WebApp = window.WebApp;
            initData = window.WebApp?.initData;
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
                reject(new Error('WebApp не загрузился после всех попыток'));
            }
        };
        
        check();
    });
}

// Функция для парсинга initData и извлечения данных пользователя
function parseInitData(initData) {
    console.log('Parsing initData:', initData);
    
    if (!initData) {
        return null;
    }

    let userData = null;

    if (typeof initData === 'object') {
        console.log('InitData is object, using directly');
        userData = initData.user || initData;
    } else if (typeof initData === 'string') {
        const decodedString = decodeURIComponent(initData);
        console.log('Decoded initData:', decodedString);

        const params = new URLSearchParams(decodedString);
        const userParam = params.get('user');
        
        if (userParam) {
            try {
                userData = JSON.parse(userParam);
                console.log('Parsed user data from string:', userData);
            } catch (e) {
                console.error('Error parsing user data from string:', e);
            }
        }
    }

    if (userData) {
        return {
            id: userData.id || null,
            username: userData.username || '',
            firstName: userData.first_name || '',
            lastName: userData.last_name || '',
            languageCode: userData.language_code || 'ru'
        };
    }

    return null;
}

async function getCurrentUser() {
    try {
        await waitForWebApp();
        
        if (!initData) {
            console.error('No init data found');
            return null;
        }

        console.log('Raw initData:', initData);

        // Парсим данные пользователя
        const userData = parseInitData(initData);
        
        if (!userData || !userData.id) {
            console.error('No user data found in initData');
            return null;
        }

        console.log('Extracted user data:', userData);
        return userData;
        
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// Глобальные переменные
let currentOnboardingScreen = 1;
const selectedOnboardingItems = {
    career: [],
    personality: [],
    relationship: [],
    values: [],
    music: [],
    movies: [],
    hobbies: [],
    events: []
};
let userBasicInfo = {
    age: '',
    city: ''
};

// Данные пользователей (будут загружаться с сервера)
let recommendedUsers = [];
let currentUserIndex = 0;
let startX = 0;
let currentX = 0;
let isDragging = false;

// Проверка авторизации
async function checkUserAuthorization() {
    const userData = await getCurrentUser();
    console.log('Проверка пользователя:', userData);
    
    if (!userData || !userData.id) {
        return { authorized: false, userData: null };
    }
    
    try {
        const response = await fetch(`http://localhost:8080/profile?id=${userData.id}`);
        
        if (!response.ok) {
            throw new Error('Ошибка HTTP: ' + response.status);
        }
        
        const serverUserData = await response.json();
        console.log('Данные пользователя с сервера:', serverUserData);
        
        if (serverUserData.id) {
            return { authorized: true, userData: serverUserData };
        } else {
            return { authorized: false, userData: null };
        }
    } catch (error) {
        console.error('Ошибка при проверке авторизации:', error);
        return { authorized: false, userData: null };
    }
}

// Загрузка рекомендаций с сервера
async function loadRecommendations() {
    try {
        const userData = await getCurrentUser();
        if (!userData || !userData.id) {
            console.error('Не удалось получить данные пользователя');
            return [];
        }
        
        console.log('Загрузка рекомендаций для пользователя:', userData.id);
        
        const response = await fetch(`http://localhost:8080/recommendations?id=${userData.id}`);
        
        if (!response.ok) {
            throw new Error('Ошибка HTTP: ' + response.status);
        }
        
        const users = await response.json();
        if (!users) {
            return [];
        }
        console.log('Получены рекомендации:', users);
        
        return users;
    } catch (error) {
        console.error('Ошибка при загрузке рекомендаций:', error);
        return [];
    }
}

// Загрузка анкеты
function loadOnboarding() {
    console.log('Загрузка анкеты...');
    
    // Сбрасываем данные
    Object.keys(selectedOnboardingItems).forEach(key => {
        selectedOnboardingItems[key] = [];
    });
    userBasicInfo = { age: '', city: '' };
    
    const mainContent = document.getElementById('mainContent');
    const body = document.body;
    
    body.classList.add('onboarding-mode');
    
    mainContent.innerHTML = `
        <div class="onboarding-container">
            <div class="onboarding-progress">
                <div class="onboarding-progress-fill" id="onboardingProgressFill"></div>
            </div>

            <!-- Экран 1: Приветствие -->
            <div class="onboarding-screen active" id="screen1">
                <div class="onboarding-header">
                    <h1 class="onboarding-title">ISKRA</h1>
                    <p class="onboarding-subtitle">Создадим твой уникальный профиль</p>
                </div>
                
                <div class="onboarding-board">
                    <div class="avatar-section">
                        <div class="onboarding-avatar">
                            <span>IS</span>
                        </div>
                    </div>
                    
                    <p class="onboarding-subtitle">Расскажи о себе, и мы найдем тебе идеальную пару</p>
                    
                    <button class="onboarding-btn active" onclick="nextOnboardingScreen(2)">
                        Начать заполнение
                    </button>
                </div>
            </div>

            <!-- Экран 2: Основная информация -->
            <div class="onboarding-screen" id="screen2">
                <div class="onboarding-header">
                    <h2 class="profile-section-title">Основная информация</h2>
                    <p class="onboarding-subtitle">Расскажи немного о себе</p>
                </div>
                
                <div class="onboarding-board">
                    <div class="onboarding-fields-grid">
                        <div class="onboarding-input-compact">
                            <div class="onboarding-input-label">Возраст</div>
                            <input type="number" class="onboarding-input-field" id="ageInput" 
                                   placeholder="Укажите возраст" min="18" max="100"
                                   oninput="updateBasicInfo('age', this.value)">
                            <span class="onboarding-input-edit">✎</span>
                        </div>
                        
                        <div class="onboarding-input-compact">
                            <div class="onboarding-input-label">Город</div>
                            <input type="text" class="onboarding-input-field" id="cityInput" 
                                   placeholder="Укажите город"
                                   oninput="updateBasicInfo('city', this.value)">
                            <span class="onboarding-input-edit">✎</span>
                        </div>
                    </div>
                    
                    <div class="selection-required" id="screen2Message">Заполните возраст и город</div>
                    
                    <button class="onboarding-btn" id="screen2Button" onclick="nextOnboardingScreen(3)">
                        Продолжить
                    </button>
                </div>
            </div>

            <!-- Экран 3: Карьера -->
            <div class="onboarding-screen" id="screen3">
                <div class="onboarding-header">
                    <h2 class="profile-section-title">Карьера</h2>
                    <p class="onboarding-subtitle">Чем ты занимаешься?</p>
                </div>
                
                <div class="onboarding-board">
                    <div class="onboarding-selected-tags" id="careerTags"></div>
                    <div class="selection-required" id="screen3Message">Выберите вариант для продолжения</div>
                    <div class="onboarding-capsules-grid" id="careerGrid"></div>
                    
                    <button class="onboarding-btn" id="screen3Button" onclick="nextOnboardingScreen(4)">
                        Продолжить
                    </button>
                </div>
            </div>

            <!-- Экран 4: Характер -->
            <div class="onboarding-screen" id="screen4">
                <div class="onboarding-header">
                    <h2 class="profile-section-title">Характер</h2>
                    <p class="onboarding-subtitle">Какой ты человек?</p>
                </div>
                
                <div class="onboarding-board">
                    <div class="onboarding-selected-tags" id="personalityTags"></div>
                    <div class="selection-required" id="screen4Message">Выберите вариант для продолжения</div>
                    <div class="onboarding-capsules-grid" id="personalityGrid"></div>
                    
                    <button class="onboarding-btn" id="screen4Button" onclick="nextOnboardingScreen(5)">
                        Далее
                    </button>
                </div>
            </div>

            <!-- Экран 5: Цели отношений -->
            <div class="onboarding-screen" id="screen5">
                <div class="onboarding-header">
                    <h2 class="profile-section-title">Цели отношений</h2>
                    <p class="onboarding-subtitle">Что ты ищешь?</p>
                </div>
                
                <div class="onboarding-board">
                    <div class="onboarding-selected-tags" id="relationshipTags"></div>
                    <div class="selection-required" id="screen5Message">Выберите вариант для продолжения</div>
                    <div class="onboarding-capsules-grid" id="relationshipGrid"></div>
                    
                    <button class="onboarding-btn" id="screen5Button" onclick="nextOnboardingScreen(6)">
                        Далее
                    </button>
                </div>
            </div>

            <!-- Экран 6: Ценности -->
            <div class="onboarding-screen" id="screen6">
                <div class="onboarding-header">
                    <h2 class="profile-section-title">Ценности</h2>
                    <p class="onboarding-subtitle">Что для тебя важно?</p>
                </div>
                
                <div class="onboarding-board">
                    <div class="onboarding-selected-tags" id="valuesTags"></div>
                    <div class="selection-required" id="screen6Message">Выберите вариант для продолжения</div>
                    <div class="onboarding-capsules-grid" id="valuesGrid"></div>
                    
                    <button class="onboarding-btn" id="screen6Button" onclick="nextOnboardingScreen(7)">
                        Далее
                    </button>
                </div>
            </div>

            <!-- Экран 7: Музыка -->
            <div class="onboarding-screen" id="screen7">
                <div class="onboarding-header">
                    <h2 class="profile-section-title">Любимая музыка</h2>
                    <p class="onboarding-subtitle">Выбери до 3 любимых жанров</p>
                </div>
                
                <div class="onboarding-board">
                    <div class="onboarding-selected-tags" id="musicTags"></div>
                    <div class="selection-counter" id="musicCounter">Выбрано: 0/3</div>
                    <div class="selection-required" id="screen7Message">Выберите до 3 жанров</div>
                    <div class="onboarding-capsules-grid" id="musicGrid"></div>
                    
                    <button class="onboarding-btn" id="screen7Button" onclick="nextOnboardingScreen(8)">
                        Продолжить
                    </button>
                </div>
            </div>

            <!-- Экран 8: Фильмы -->
            <div class="onboarding-screen" id="screen8">
                <div class="onboarding-header">
                    <h2 class="profile-section-title">Любимые фильмы</h2>
                    <p class="onboarding-subtitle">Выбери до 3 любимых жанров</p>
                </div>
                
                <div class="onboarding-board">
                    <div class="onboarding-selected-tags" id="moviesTags"></div>
                    <div class="selection-counter" id="moviesCounter">Выбрано: 0/3</div>
                    <div class="selection-required" id="screen8Message">Выберите до 3 жанров</div>
                    <div class="onboarding-capsules-grid" id="moviesGrid"></div>
                    
                    <button class="onboarding-btn" id="screen8Button" onclick="nextOnboardingScreen(9)">
                        Продолжить
                    </button>
                </div>
            </div>

            <!-- Экран 9: Хобби -->
            <div class="onboarding-screen" id="screen9">
                <div class="onboarding-header">
                    <h2 class="profile-section-title">Хобби и увлечения</h2>
                    <p class="onboarding-subtitle">Выбери до 3 своих увлечений</p>
                </div>
                
                <div class="onboarding-board">
                    <div class="onboarding-selected-tags" id="hobbiesTags"></div>
                    <div class="selection-counter" id="hobbiesCounter">Выбрано: 0/3</div>
                    <div class="selection-required" id="screen9Message">Выберите до 3 увлечений</div>
                    <div class="onboarding-capsules-grid" id="hobbiesGrid"></div>
                    
                    <button class="onboarding-btn" id="screen9Button" onclick="nextOnboardingScreen(10)">
                        Продолжить
                    </button>
                </div>
            </div>

            <!-- Экран 10: Мероприятия -->
            <div class="onboarding-screen" id="screen10">
                <div class="onboarding-header">
                    <h2 class="profile-section-title">Мероприятия</h2>
                    <p class="onboarding-subtitle">Куда бы хотел сходить с кем-то?</p>
                </div>
                
                <div class="onboarding-board">
                    <div class="onboarding-selected-tags" id="eventsTags"></div>
                    <div class="selection-counter" id="eventsCounter">Выбрано: 0/3</div>
                    <div class="selection-required" id="screen10Message">Выберите до 3 мероприятий</div>
                    <div class="onboarding-capsules-grid" id="eventsGrid"></div>
                    
                    <button class="onboarding-btn" id="screen10Button" onclick="completeOnboarding()">
                        Завершить профиль
                    </button>
                </div>
            </div>
        </div>
    `;
    
    initOnboarding();
}

// Функция для разделения строки по запятым
function splitStringByCommas(str) {
    if (!str) return [];
    return str.split(',').map(item => item.trim()).filter(item => item !== '');
}

// Загрузка основного контента (карточки пользователей)
async function loadMainContent(userData) {
    console.log('Загрузка основного контента:', userData);
    
    const mainContent = document.getElementById('mainContent');
    const body = document.body;
    
    body.classList.remove('onboarding-mode');
    currentUserIndex = 0;

    // Показываем загрузку
    mainContent.innerHTML = `
        <div class="main-app">
            <div class="cards-container">
                <div class="loading-message">
                    <div class="loading-spinner"></div>
                    <p>Ищем подходящие анкеты...</p>
                </div>
            </div>
        </div>
    `;

    // Загружаем рекомендации
    recommendedUsers = await loadRecommendations();

    // Показываем карточки
    mainContent.innerHTML = `
        <div class="main-app">
            <div class="cards-container">
                <div class="no-users-message" id="noUsersMessage" style="display: none;">
                    <div class="message-icon">💫</div>
                    <h3>Анкеты закончились</h3>
                    <p>Возвращайтесь позже, чтобы увидеть новые рекомендации</p>
                </div>
                
                <div class="user-card" id="userCard">
                    <div class="card-background"></div>
                    <div class="swipe-overlay swipe-like"></div>
                    <div class="swipe-overlay swipe-dislike"></div>
                    <div class="card-content">
                        <div class="card-main-info">
                            <h2 class="user-name" id="userName">Имя</h2>
                            <div class="user-age-city" id="userAgeCity">Возраст • Город</div>
                            <div class="user-events-tags" id="userEventsTags"></div>
                        </div>
                        
                        <button class="show-more-btn" onclick="toggleUserDetails()">
                            Показать больше
                            <span class="arrow">▼</span>
                        </button>
                        
                        <div class="user-details" id="userDetails">
                            <div class="details-section">
                                <h4>О себе</h4>
                                <div class="detail-item">
                                    <span class="detail-label">Карьера:</span>
                                    <span class="detail-value" id="detailCareer">-</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Характер:</span>
                                    <span class="detail-value" id="detailPersonality">-</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Цели отношений:</span>
                                    <span class="detail-value" id="detailRelationship">-</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Ценности:</span>
                                    <span class="detail-value" id="detailValues">-</span>
                                </div>
                            </div>
                            
                            <div class="details-section">
                                <h4>Интересы</h4>
                                <div class="detail-item">
                                    <span class="detail-label">Музыка:</span>
                                    <span class="detail-value tags-container" id="detailMusic"></span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Фильмы:</span>
                                    <span class="detail-value tags-container" id="detailMovies"></span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Хобби:</span>
                                    <span class="detail-value tags-container" id="detailHobbies"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    loadNextUser();
    initSwipeHandlers();
}

// Загрузка следующего пользователя
function loadNextUser() {
    if (currentUserIndex >= recommendedUsers.length) {
        document.getElementById('noUsersMessage').style.display = 'flex';
        document.getElementById('userCard').style.display = 'none';
        return;
    }
    
    const user = recommendedUsers[currentUserIndex];
    const userCard = document.getElementById('userCard');
    
    // Анимация появления
    userCard.style.opacity = '0';
    userCard.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        // Обновляем данные из структуры UserDB
        document.getElementById('userName').textContent = user.name || 'Не указано';
        document.getElementById('userAgeCity').textContent = `${user.age || '?'} • ${user.city || 'Не указан'}`;
        
        // Обрабатываем мероприятия как теги
        const eventsTagsContainer = document.getElementById('userEventsTags');
        eventsTagsContainer.innerHTML = '';
        const events = splitStringByCommas(user.event_preferences);
        if (events.length > 0) {
            events.forEach(event => {
                const tag = document.createElement('span');
                tag.className = 'event-tag';
                tag.textContent = event;
                eventsTagsContainer.appendChild(tag);
            });
        } else {
            eventsTagsContainer.innerHTML = '<span class="no-data">Не указаны</span>';
        }
        
        // Детальная информация
        document.getElementById('detailCareer').textContent = user.career_type || 'Не указана';
        document.getElementById('detailPersonality').textContent = user.personality_type || 'Не указан';
        document.getElementById('detailRelationship').textContent = user.relationship_goal || 'Не указаны';
        document.getElementById('detailValues').textContent = user.important_values || 'Не указаны';
        
        // Обрабатываем интересы как теги
        updateTagsContainer('detailMusic', user.music);
        updateTagsContainer('detailMovies', user.films);
        updateTagsContainer('detailHobbies', user.hobbies);
        
        // Сбрасываем детали и подсветку
        document.getElementById('userDetails').classList.remove('active');
        resetSwipeOverlay();
        
        // Анимация появления
        userCard.style.opacity = '1';
        userCard.style.transform = 'translateY(0)';
    }, 200);
}

// Обновление контейнера с тегами
function updateTagsContainer(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    const tags = splitStringByCommas(data);
    if (tags.length > 0) {
        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'interest-tag';
            tagElement.textContent = tag;
            container.appendChild(tagElement);
        });
    } else {
        container.innerHTML = '<span class="no-data">Не указаны</span>';
    }
}

// Переключение детальной информации
function toggleUserDetails() {
    const details = document.getElementById('userDetails');
    const arrow = document.querySelector('.arrow');
    
    details.classList.toggle('active');
    arrow.style.transform = details.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0)';
}

// Отправка лайка/дизлайка на сервер
async function sendInteraction(targetUserId, isLike) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || !currentUser.id) {
            console.error('Не удалось получить данные текущего пользователя');
            return;
        }
        
        const interactionType = isLike ? 'like' : 'dislike';
        
        console.log(`Отправка взаимодействия: ${interactionType} для пользователя ${targetUserId}`);
        
        const response = await fetch('http://localhost:8080/interaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                target_user_id: targetUserId,
                interaction_type: interactionType
            })
        });
        
        if (response.ok) {
            console.log('Взаимодействие успешно отправлено');
        } else {
            console.error('Ошибка при отправке взаимодействия:', response.status);
        }
    } catch (error) {
        console.error('Ошибка при отправке взаимодействия:', error);
    }
}

// Инициализация свайпов
function initSwipeHandlers() {
    const card = document.getElementById('userCard');
    
    card.addEventListener('touchstart', handleTouchStart, { passive: false });
    card.addEventListener('touchmove', handleTouchMove, { passive: false });
    card.addEventListener('touchend', handleTouchEnd);
    
    card.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

// Обработчики для тач-событий
function handleTouchStart(e) {
    if (e.touches.length > 1) return;
    
    const touch = e.touches[0];
    startX = touch.clientX;
    currentX = startX;
    isDragging = true;
    
    const card = document.getElementById('userCard');
    card.style.transition = 'none';
    resetSwipeOverlay();
}

function handleTouchMove(e) {
    if (!isDragging || e.touches.length > 1) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    currentX = touch.clientX;
    updateCardPosition();
    updateSwipeOverlay();
}

function handleTouchEnd() {
    if (!isDragging) return;
    
    isDragging = false;
    handleSwipeEnd();
}

// Обработчики для мыши
function handleMouseDown(e) {
    startX = e.clientX;
    currentX = startX;
    isDragging = true;
    
    const card = document.getElementById('userCard');
    card.style.transition = 'none';
    resetSwipeOverlay();
}

function handleMouseMove(e) {
    if (!isDragging) return;
    
    currentX = e.clientX;
    updateCardPosition();
    updateSwipeOverlay();
}

function handleMouseUp() {
    if (!isDragging) return;
    
    isDragging = false;
    handleSwipeEnd();
}

// Обновление позиции карточки
function updateCardPosition() {
    const card = document.getElementById('userCard');
    const deltaX = currentX - startX;
    const rotation = deltaX * 0.1;
    
    card.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;
}

// Обновление подсветки свайпа
function updateSwipeOverlay() {
    const deltaX = currentX - startX;
    const swipeThreshold = 50;
    
    const likeOverlay = document.querySelector('.swipe-like');
    const dislikeOverlay = document.querySelector('.swipe-dislike');
    
    // Сбрасываем все подсветки
    likeOverlay.style.opacity = '0';
    dislikeOverlay.style.opacity = '0';
    
    if (deltaX > swipeThreshold) {
        // Свайп вправо - лайк (зеленая подсветка)
        likeOverlay.style.opacity = Math.min((deltaX - swipeThreshold) / 100, 0.3).toString();
    } else if (deltaX < -swipeThreshold) {
        // Свайп влево - дизлайк (красная подсветка)
        dislikeOverlay.style.opacity = Math.min(Math.abs(deltaX + swipeThreshold) / 100, 0.3).toString();
    }
}

// Сброс подсветки свайпа
function resetSwipeOverlay() {
    const likeOverlay = document.querySelector('.swipe-like');
    const dislikeOverlay = document.querySelector('.swipe-dislike');
    
    likeOverlay.style.opacity = '0';
    dislikeOverlay.style.opacity = '0';
}

// Обработка завершения свайпа
function handleSwipeEnd() {
    const card = document.getElementById('userCard');
    const deltaX = currentX - startX;
    const swipeThreshold = 100;
    
    card.style.transition = 'all 0.5s ease';
    
    if (Math.abs(deltaX) > swipeThreshold) {
        // Свайп влево (дизлайк) или вправо (лайк)
        const direction = deltaX > 0 ? 1 : -1;
        const isLike = deltaX > 0;
        
        card.style.transform = `translateX(${direction * 500}px) rotate(${direction * 30}deg)`;
        card.style.opacity = '0';
        
        // Отправляем взаимодействие на сервер
        const currentUser = recommendedUsers[currentUserIndex];
        if (currentUser) {
            sendInteraction(currentUser.id, isLike);
        }
        
        setTimeout(() => {
            currentUserIndex++;
            loadNextUser();
            resetCardPosition();
        }, 300);
        
        console.log(isLike ? 'Лайк' : 'Дизлайк', recommendedUsers[currentUserIndex]?.name);
        
    } else {
        // Возвращаем карточку на место
        resetCardPosition();
    }
    
    resetSwipeOverlay();
}

// Сброс позиции карточки
function resetCardPosition() {
    const card = document.getElementById('userCard');
    card.style.transform = 'translateX(0) rotate(0)';
    card.style.opacity = '1';
}

// Инициализация анкеты
function initOnboarding() {
    console.log('Инициализация анкеты...');
    
    const capsuleData = {
        career: ['IT и технологии', 'Дизайн и UX', 'Медицина', 'Образование', 'Бизнес', 'Финансы', 'Маркетинг', 'Искусство', 'Музыка', 'Кино', 'Фотография', 'Архитектура', 'Инженерия', 'Недвижимость', 'Юриспруденция', 'Психология'],
        personality: ['Экстраверт', 'Интроверт', 'Амбиверт', 'Аналитик', 'Творец', 'Прагматик', 'Романтик', 'Реалист', 'Оптимист', 'Философ', 'Новатор', 'Лидер', 'Целеустремленный', 'Гибкий', 'Настойчивый', 'Командный'],
        relationship: ['Серьезные отношения', 'Дружба', 'Несерьезные отношения', 'Создание семьи', 'Поиск партнера', 'Романтика', 'Деловое партнерство', 'Творчество', 'Путешествия', 'Совместные проекты', 'Духовность', 'Карьера'],
        values: ['Любовь и забота', 'Семья', 'Карьера', 'Финансы', 'Духовность', 'Здоровье', 'Образование', 'Творчество', 'Свобода', 'Приключения', 'Безопасность', 'Экология'],
        music: ['Поп', 'Рок', 'Хип-хоп', 'Электроника', 'Джаз', 'Классика', 'R&B', 'Метал', 'Инди', 'Фолк', 'Кантри', 'Регги', 'Блюз', 'Соул', 'Диско', 'Альтернатива', 'Рэп'],
        movies: ['Комедия', 'Драма', 'Боевик', 'Триллер', 'Ужасы', 'Фантастика', 'Фэнтези', 'Мелодрама', 'Детектив', 'Приключения', 'Аниме', 'Документальный', 'Артхаус', 'Исторический', 'Криминал', 'Мюзикл'],
        hobbies: ['Спорт', 'Путешествия', 'Кулинария', 'Фотография', 'Рисование', 'Танцы', 'Йога', 'Велоспорт', 'Гейминг', 'Чтение', 'Садоводство', 'Рукоделие', 'Музыка', 'Театр', 'Кино', 'Настолки', 'Рыбалка', 'Охота', 'Авто', 'Технологии'],
        events: ['Концерты', 'Кино', 'Выставки', 'Театры', 'Фестивали', 'Спортивные события', 'Вечеринки', 'Клубы', 'Рестораны', 'Кафе', 'Пикники', 'Походы', 'Мастер-классы', 'Лекции', 'Йога-сессии', 'Танцы', 'Настольные игры', 'Караоке', 'Боулинг', 'Картинг']
    };

    Object.keys(capsuleData).forEach(category => {
        const grid = document.getElementById(`${category}Grid`);
        if (!grid) {
            console.error('Не найден контейнер для:', category);
            return;
        }

        grid.innerHTML = '';
        capsuleData[category].forEach(item => {
            const capsule = document.createElement('div');
            capsule.className = 'onboarding-capsule';
            
            if (['music', 'movies', 'hobbies', 'events'].includes(category)) {
                capsule.classList.add('multiple');
            }
            
            capsule.textContent = item;
            capsule.addEventListener('click', () => toggleOnboardingCapsule(category, item, capsule));
            grid.appendChild(capsule);
        });
        
        console.log(`Загружено ${capsuleData[category].length} элементов для ${category}`);
    });

    updateOnboardingProgress();
}

// Обновление базовой информации
function updateBasicInfo(field, value) {
    console.log(`Обновление ${field}:`, value);
    userBasicInfo[field] = value;
    checkScreen2Complete();
}

// Проверка заполненности второго экрана
function checkScreen2Complete() {
    const isComplete = userBasicInfo.age && userBasicInfo.city;
    const button = document.getElementById('screen2Button');
    const message = document.getElementById('screen2Message');
    
    console.log('Проверка экрана 2:', { isComplete, age: userBasicInfo.age, city: userBasicInfo.city });
    
    if (button) {
        if (isComplete) {
            button.classList.add('active');
            if (message) message.textContent = '';
        } else {
            button.classList.remove('active');
            if (message) message.textContent = 'Заполните возраст и город';
        }
    }
    return isComplete;
}

// Переключение капсулы
function toggleOnboardingCapsule(category, text, capsule) {
    console.log(`Клик по капсуле: ${category} - ${text}`);
    
    const index = selectedOnboardingItems[category].indexOf(text);
    const isMultiple = ['music', 'movies', 'hobbies', 'events'].includes(category);
    const maxSelection = 3;
    
    if (index === -1) {
        if (isMultiple) {
            if (selectedOnboardingItems[category].length >= maxSelection) {
                console.log('Достигнут лимит выбора для', category);
                return;
            }
            selectedOnboardingItems[category].push(text);
            capsule.classList.add('selected');
        } else {
            document.querySelectorAll(`#${category}Grid .onboarding-capsule`).forEach(c => {
                c.classList.remove('selected');
            });
            selectedOnboardingItems[category] = [text];
            capsule.classList.add('selected');
        }
    } else {
        selectedOnboardingItems[category].splice(index, 1);
        capsule.classList.remove('selected');
    }
    
    console.log(`Текущий выбор для ${category}:`, selectedOnboardingItems[category]);
    
    updateOnboardingTags(category);
    updateSelectionCounter(category);
    
    if (isMultiple) {
        updateMultipleSelectionButtonState(category);
    } else {
        updateCapsulesButtonState(category);
    }
}

// Обновление тегов
function updateOnboardingTags(category) {
    const tagsContainer = document.getElementById(`${category}Tags`);
    if (!tagsContainer) return;
    
    tagsContainer.innerHTML = '';
    
    selectedOnboardingItems[category].forEach(item => {
        const tag = document.createElement('div');
        tag.className = 'onboarding-selected-tag';
        tag.innerHTML = `${item} <span class="remove-tag" onclick="removeSelectedItem('${category}', '${item}')">×</span>`;
        tagsContainer.appendChild(tag);
    });
}

// Удаление выбранного элемента
function removeSelectedItem(category, item) {
    console.log(`Удаление: ${category} - ${item}`);
    
    const index = selectedOnboardingItems[category].indexOf(item);
    if (index !== -1) {
        selectedOnboardingItems[category].splice(index, 1);
        
        const grid = document.getElementById(`${category}Grid`);
        if (grid) {
            const capsules = grid.querySelectorAll('.onboarding-capsule');
            capsules.forEach(capsule => {
                if (capsule.textContent === item) {
                    capsule.classList.remove('selected');
                }
            });
        }
        
        updateOnboardingTags(category);
        updateSelectionCounter(category);
        
        if (['music', 'movies', 'hobbies', 'events'].includes(category)) {
            updateMultipleSelectionButtonState(category);
        } else {
            updateCapsulesButtonState(category);
        }
    }
}

// Обновление счетчика выбора
function updateSelectionCounter(category) {
    const counter = document.getElementById(`${category}Counter`);
    if (!counter) return;
    
    const count = selectedOnboardingItems[category].length;
    const maxSelection = 3;
    counter.textContent = `Выбрано: ${count}/${maxSelection}`;
    
    if (count >= maxSelection) {
        counter.style.color = '#ffaa00';
    } else {
        counter.style.color = 'rgba(255, 170, 0, 0.7)';
    }
}

// Обновление состояния кнопок для одиночного выбора
function updateCapsulesButtonState(category) {
    const screenNumber = getScreenByCategory(category);
    const button = document.getElementById(`screen${screenNumber}Button`);
    const message = document.getElementById(`screen${screenNumber}Message`);
    
    if (button) {
        const hasSelection = selectedOnboardingItems[category].length > 0;
        console.log(`Обновление кнопки экрана ${screenNumber}:`, hasSelection);
        
        if (hasSelection) {
            button.classList.add('active');
            if (message) message.textContent = '';
        } else {
            button.classList.remove('active');
            if (message) message.textContent = 'Выберите вариант для продолжения';
        }
    }
}

// Обновление состояния кнопки для множественного выбора
function updateMultipleSelectionButtonState(category) {
    const screenNumber = getScreenByCategory(category);
    const button = document.getElementById(`screen${screenNumber}Button`);
    const message = document.getElementById(`screen${screenNumber}Message`);
    
    if (button) {
        const count = selectedOnboardingItems[category].length;
        console.log(`Обновление кнопки множественного выбора ${screenNumber}:`, count);
        
        if (count > 0) {
            button.classList.add('active');
            if (message) message.textContent = '';
        } else {
            button.classList.remove('active');
            if (message) message.textContent = 'Выберите до 3 вариантов';
        }
    }
}

// Вспомогательные функции
function getCategoryByScreen(screenNumber) {
    const categories = ['career', 'personality', 'relationship', 'values', 'music', 'movies', 'hobbies', 'events'];
    return categories[screenNumber - 3] || 'career';
}

function getScreenByCategory(category) {
    const categories = ['career', 'personality', 'relationship', 'values', 'music', 'movies', 'hobbies', 'events'];
    return categories.indexOf(category) + 3;
}

// Переход между экранами
function nextOnboardingScreen(screenNumber) {
    console.log(`Переход с экрана ${currentOnboardingScreen} на ${screenNumber}`);
    
    if (currentOnboardingScreen === 2 && !checkScreen2Complete()) {
        console.log('Нельзя перейти - не заполнены основные поля');
        return;
    }
    
    if (currentOnboardingScreen >= 3 && currentOnboardingScreen <= 6) {
        const currentCategory = getCategoryByScreen(currentOnboardingScreen);
        if (selectedOnboardingItems[currentCategory].length === 0) {
            console.log('Нельзя перейти - не выбран вариант');
            return;
        }
    }
    
    if (currentOnboardingScreen >= 7) {
        const currentCategory = getCategoryByScreen(currentOnboardingScreen);
        if (selectedOnboardingItems[currentCategory].length === 0) {
            console.log('Нельзя перейти - не выбрано ни одного варианта');
            return;
        }
    }
    
    const currentScreen = document.getElementById(`screen${currentOnboardingScreen}`);
    const nextScreen = document.getElementById(`screen${screenNumber}`);
    
    if (currentScreen) currentScreen.classList.remove('active');
    if (nextScreen) nextScreen.classList.add('active');
    
    currentOnboardingScreen = screenNumber;
    updateOnboardingProgress();
}

// Обновление прогресса
function updateOnboardingProgress() {
    const progressFill = document.getElementById('onboardingProgressFill');
    if (!progressFill) return;
    
    const progress = (currentOnboardingScreen - 1) / 9 * 100;
    progressFill.style.width = progress + '%';
    console.log(`Прогресс: ${progress}%`);
}

// Завершение онбординга
async function completeOnboarding() {
    console.log('Завершение онбординга...');
    console.log('Собранные данные:', {
        basic: userBasicInfo,
        selections: selectedOnboardingItems
    });
    
    try {
        const userData = await getCurrentUser();
        if (!userData || !userData.id) {
            alert('Ошибка: пользователь не авторизован');
            return;
        }
        
        // Создаем имя пользователя из firstName и lastName
        const name = userData.firstName || '';
        const surname = userData.lastName || '';
        const fullName = [name, surname].filter(Boolean).join(' ') || userData.username || 'Пользователь';
        
        const profileData = {
            id: userData.id,
            username: userData.username || '',
            name: fullName,
            surname: surname,
            age: parseInt(userBasicInfo.age),
            city: userBasicInfo.city,
            career_type: selectedOnboardingItems.career[0] || '',
            personality_type: selectedOnboardingItems.personality[0] || '',
            relationship_goal: selectedOnboardingItems.relationship[0] || '',
            important_values: selectedOnboardingItems.values[0] || '',
            music: selectedOnboardingItems.music.join(',') || '',
            films: selectedOnboardingItems.movies.join(',') || '',
            hobbies: selectedOnboardingItems.hobbies.join(',') || '',
            event_preferences: selectedOnboardingItems.events.join(',') || ''
        };

        console.log('Отправка данных на сервер:', profileData);
        
        const response = await fetch('http://localhost:8080/createuser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });

        if (response.ok) {
            console.log('Профиль успешно создан');
            location.reload();
        } else {
            console.error('Ошибка при создании профиля:', response.status);
            alert('Ошибка при создании профиля');
        }

    } catch (error) {
        console.error('Ошибка при сохранении профиля:', error);
        alert('Ошибка при сохранении профиля');
    }
}

function editProfile() {
    console.log('Редактирование профиля...');
    loadOnboarding();
}

// Основная функция
async function initApp() {
    console.log('Инициализация приложения...');
    
    try {
        // Ждем загрузки WebApp
        await waitForWebApp();
        
        const authStatus = await checkUserAuthorization();
        console.log('Статус авторизации:', authStatus);
        
        if (authStatus.authorized) {
            loadMainContent(authStatus.userData);
        } else {
            loadOnboarding();
        }
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        // Если WebApp не загрузился, все равно показываем онбординг
        loadOnboarding();
    }
}

// Запускаем приложение после загрузки DOM
document.addEventListener('DOMContentLoaded', initApp);