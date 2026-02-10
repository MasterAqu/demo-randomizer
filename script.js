/**
 * Vims-Randomizer - Улучшенное приложение для случайного выбора участников
 * @version 2.0.0
 * @author AI Assistant
 */

// Константы конфигурации
const CONFIG = {
    MAX_PARTICIPANTS: 1000,
    MIN_PARTICIPANTS: 1,
    ANIMATION_INTERVAL: 80,
    MIN_ITERATIONS: 20,
    MAX_ITERATIONS: 35,
    BOUNCING_DURATION: 500,
    ANIMATION_FREQUENCY: 5,
    UNDO_LIMIT: 10,
    STORAGE_KEY: 'vims-randomizer-settings',
    DEFAULT_SETTINGS: {
        animationDuration: 2,
        soundEnabled: true,
        darkMode: true
    }
};

// Утилиты для логирования
class Logger {
    static info(message, data = null) {
        console.log(`[Vims-Randomizer INFO] ${message}`, data);
    }
    
    static error(message, error = null) {
        console.error(`[Vims-Randomizer ERROR] ${message}`, error);
    }
    
    static warn(message, data = null) {
        console.warn(`[Vims-Randomizer WARN] ${message}`, data);
    }
    
    static performance(label, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        Logger.info(`${label} took ${end - start} milliseconds`);
        return result;
    }
}

// Утилиты для работы с DOM
class DOMUtils {
    static createElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (textContent) element.textContent = textContent;
        return element;
    }
    
    static addEventListenerSafe(element, event, handler) {
        if (element && typeof element.addEventListener === 'function') {
            element.addEventListener(event, handler);
        } else {
            Logger.warn(`Cannot add event listener to element:`, element);
        }
    }
    
    static updateElementText(element, text) {
        if (element) {
            element.textContent = text;
            // Устанавливаем data-text для эффекта глитча (псевдо-элементы)
            element.setAttribute('data-text', text);
        }
    }
    
    static updateElementClass(element, className, add = true) {
        if (element) {
            if (add) {
                element.classList.add(className);
            } else {
                element.classList.remove(className);
            }
        }
    }
}

// Утилиты для валидации
class ValidationUtils {
    static validateParticipantCount(count) {
        if (typeof count !== 'number' || !Number.isInteger(count)) {
            return { valid: false, message: 'Введите целое число!' };
        }
        if (count < CONFIG.MIN_PARTICIPANTS) {
            return { valid: false, message: `Минимум ${CONFIG.MIN_PARTICIPANTS} участник!` };
        }
        if (count > CONFIG.MAX_PARTICIPANTS) {
            return { valid: false, message: `Максимум ${CONFIG.MAX_PARTICIPANTS} участников!` };
        }
        return { valid: true };
    }
    
    static sanitizeInput(value) {
        if (typeof value !== 'string') return '';
        return value.trim().replace(/[<>]/g, '');
    }
}

// Класс приложения
class VimsRandomizer {
    constructor() {
        this.state = this.createInitialState();
        this.elements = this.initializeElements();
        this.settings = this.loadSettings();
        this.uiOptimizer = new UIOptimizer();
        this.bindEvents();
        this.init();
    }
    
    createInitialState() {
        return {
            participants: [],
            remainingParticipants: [],
            history: [],
            isRandomizing: false,
            intervalId: null,
            undoStack: [],
            sessionId: this.generateSessionId()
        };
    }
    
    initializeElements() {
        return {
            participantCount: document.getElementById('participantCount'),
            addParticipants: document.getElementById('addParticipants'),
            addDemoToActive: document.getElementById('addDemoToActive'),
            startRandom: document.getElementById('startRandom'),
            undoLast: document.getElementById('undoLast'),
            resetAll: document.getElementById('resetAll'),
            currentParticipant: document.getElementById('currentParticipant'),
            participantHistory: document.getElementById('participantHistory'),
            demoCount: document.getElementById('demoCount'),
            remainingCount: document.getElementById('remainingCount'),
            statusMessage: document.getElementById('statusMessage'),
            inputGroup: document.querySelector('.input-group')
        };
    }
    
    loadSettings() {
        // Фиксированные настройки: темная тема, минимальная анимация (1 сек), без звука
        return {
            animationDuration: 1,
            soundEnabled: false,
            darkMode: true
        };
    }
    
    saveSettings() {
        // Настройки не сохраняются - используются фиксированные значения
        Logger.info('Using fixed settings: dark mode, min animation, no sound');
    }
    
    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    bindEvents() {
        const e = this.elements;
        
        // Основные события
        DOMUtils.addEventListenerSafe(e.addParticipants, 'click', () => this.handleAddParticipants());
        DOMUtils.addEventListenerSafe(e.addDemoToActive, 'click', () => this.handleAddDemoToActive());
        DOMUtils.addEventListenerSafe(e.startRandom, 'click', () => this.handleStartRandom());
        DOMUtils.addEventListenerSafe(e.undoLast, 'click', () => this.handleUndoLast());
        DOMUtils.addEventListenerSafe(e.resetAll, 'click', () => this.handleResetAll());
        
        // Обработка Enter в поле ввода
        DOMUtils.addEventListenerSafe(e.participantCount, 'keypress', (event) => {
            if (event.key === 'Enter') {
                // Если еще нет участников - добавляем первую партию, иначе добавляем еще
                if (this.state.participants.length === 0) {
                    this.handleAddParticipants();
                } else {
                    this.handleAddDemoToActive();
                }
            }
        });
    }
    
    init() {
        Logger.info('Initializing Vims-Randomizer...');
        this.applyTheme();
        this.updateInputPanelState();
        this.updateStatus('Готов к работе! Введите количество демо.', 'success');
        Logger.info('Vims-Randomizer initialized successfully');
    }
    
    applyTheme() {
        // Всегда используем темную тему
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    updateInputPanelState() {
        const hasParticipants = this.state.participants.length > 0;
        const e = this.elements;
        const inputLabel = document.getElementById('inputLabel');

        if (hasParticipants) {
            // Скрываем кнопку начального добавления, показываем кнопку "добавить еще"
            if (e.addParticipants) e.addParticipants.style.display = 'none';
            if (e.addDemoToActive) e.addDemoToActive.style.display = 'inline-block';
            // Меняем текст для ясности
            if (e.participantCount) e.participantCount.placeholder = 'Сколько добавить?';
            if (inputLabel) inputLabel.textContent = 'Добавить демо:';
        } else {
            // Показываем начальную кнопку, скрываем "добавить еще"
            if (e.addParticipants) e.addParticipants.style.display = 'inline-block';
            if (e.addDemoToActive) e.addDemoToActive.style.display = 'none';
            if (e.participantCount) e.participantCount.placeholder = 'Введите число...';
            if (inputLabel) inputLabel.textContent = 'Количество демо:';
        }
    }

    // Основные методы обработки событий
    handleAddParticipants() {
        const countInput = this.elements.participantCount.value;
        const sanitizedInput = ValidationUtils.sanitizeInput(countInput);
        const count = parseInt(sanitizedInput);
        
        const validation = ValidationUtils.validateParticipantCount(count);
        if (!validation.valid) {
            this.updateStatus(validation.message, 'error');
            this.announceToScreenReader(validation.message);
            return;
        }
        
        Logger.performance('handleAddParticipants', () => {
            this.addParticipants(count);
        });
        
        // Очищаем поле ввода после успешной обработки
        this.elements.participantCount.value = '';
    }
    
    handleAddDemoToActive() {
        const countInput = this.elements.participantCount.value;
        const sanitizedInput = ValidationUtils.sanitizeInput(countInput);
        const countToAdd = parseInt(sanitizedInput);
        
        const validation = ValidationUtils.validateParticipantCount(countToAdd);
        if (!validation.valid) {
            this.updateStatus(validation.message, 'error');
            this.announceToScreenReader(validation.message);
            return;
        }
        
        Logger.performance('handleAddDemoToActive', () => {
            this.addDemoToActive(countToAdd);
        });
    }
    
    handleStartRandom() {
        if (this.state.remainingParticipants.length === 0) {
            this.updateStatus('Все демо уже выбраны! Нажмите "Сбросить всё" для нового раунда.', 'warning');
            this.announceToScreenReader('Все участники уже выбраны');
            return;
        }
        
        this.startAutoRandomization();
    }
    
    handleUndoLast() {
        if (this.state.undoStack.length === 0) {
            this.updateStatus('Нечего отменять!', 'warning');
            return;
        }
        
        const lastState = this.state.undoStack.pop();
        this.restoreState(lastState);
        this.updateStatus('Последний выбор отменён!', 'success');
        this.updateUndoButtonState();
        Logger.info('Undo performed successfully');
    }
    
    handleResetAll() {
        if (this.state.isRandomizing) {
            this.stopRandomization();
        }
        
        this.resetAll();
        this.updateStatus('Состояние сброшено. Введите количество демо для начала.', 'success');
        Logger.info('Reset all performed');
    }
    
    // Основная логика
    addParticipants(count) {
        this.state.participants = [];
        this.state.remainingParticipants = [];
        this.state.history = [];
        this.state.undoStack = []; // Очищаем стек undo при новом наборе
        this.state.isRandomizing = false;
        
        // Сбрасываем главное окно к начальному состоянию
        DOMUtils.updateElementText(this.elements.currentParticipant, '?');
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'glitching', false);
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'pulsing', false);
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'bouncing', false);

        for (let i = 1; i <= count; i++) {
            const participant = {
                id: i,
                name: `Демо ${i}`
            };
            this.state.participants.push(participant);
            this.state.remainingParticipants.push(participant);
        }
        
        this.updateUI();
        this.updateUndoButtonState();
        this.updateInputPanelState(); // Обновляем состояние панели ввода
        this.updateStatus(`Добавлено ${count} демо. Нажмите "Поехали" для начала!`, 'success');
        this.announceToScreenReader(`Добавлено ${count} участников`);
    }
    
    addDemoToActive(countToAdd) {
        const currentMaxId = this.state.participants.length > 0
            ? Math.max(...this.state.participants.map(p => p.id)) 
            : 0;
        
        for (let i = 1; i <= countToAdd; i++) {
            const newId = currentMaxId + i;
            const newDemo = {
                id: newId,
                name: `Демо ${newId}`
            };
            this.state.participants.push(newDemo);
            this.state.remainingParticipants.push(newDemo);
        }
        
        this.updateUI();
        this.updateStatus(`Добавлено ${countToAdd} демо. Всего: ${this.state.participants.length}, Осталось: ${this.state.remainingParticipants.length}`, 'success');
        this.announceToScreenReader(`Добавлено ${countToAdd} участников`);
        
        this.elements.participantCount.value = '';
    }
    
    startAutoRandomization() {
        this.state.isRandomizing = true;
        this.elements.startRandom.disabled = true;
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'glitching', true);

        let counter = 0;
        const totalIterations = this.calculateIterations();
        
        this.state.intervalId = setInterval(() => {
            this.animateRandomSelection(counter, totalIterations);
            counter++;
            
            if (counter >= totalIterations) {
                this.stopRandomization();
                this.selectWinner();
            }
        }, CONFIG.ANIMATION_INTERVAL);
        
        this.updateStatus('Рандомизация в процессе...', 'warning');
        this.announceToScreenReader('Рандомизация началась');
    }
    
    calculateIterations() {
        const baseIterations = CONFIG.MIN_ITERATIONS;
        const randomAddition = Math.floor(Math.random() * (CONFIG.MAX_ITERATIONS - CONFIG.MIN_ITERATIONS));
        const durationMultiplier = this.settings.animationDuration / 2; // Базовая длительность 2 сек
        return Math.floor((baseIterations + randomAddition) * durationMultiplier);
    }
    
    animateRandomSelection(counter, totalIterations) {
        if (this.state.remainingParticipants.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * this.state.remainingParticipants.length);
        const tempParticipant = this.state.remainingParticipants[randomIndex];
        
        DOMUtils.updateElementText(this.elements.currentParticipant, tempParticipant.name);
        
        if (counter % CONFIG.ANIMATION_FREQUENCY === 0) {
            DOMUtils.updateElementClass(this.elements.currentParticipant, 'pulsing', true);
            setTimeout(() => {
                DOMUtils.updateElementClass(this.elements.currentParticipant, 'pulsing', false);
            }, 200);
        }
    }
    
    stopRandomization() {
        if (this.state.intervalId) {
            clearInterval(this.state.intervalId);
            this.state.intervalId = null;
        }
        
        this.state.isRandomizing = false;
        this.elements.startRandom.disabled = false;
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'glitching', false);
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'pulsing', false);
    }
    
    selectWinner() {
        if (this.state.remainingParticipants.length === 0) return;
        
        // Сохраняем состояние перед выбором победителя (для возможности отмены)
        this.saveStateForUndo();

        const randomIndex = Math.floor(Math.random() * this.state.remainingParticipants.length);
        const winner = this.state.remainingParticipants.splice(randomIndex, 1)[0];
        
        // Обновляем состояние истории
        this.state.history.push(winner);

        // Сразу показываем победителя в главном окне
        DOMUtils.updateElementText(this.elements.currentParticipant, winner.name);
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'winner-reveal', true);
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'winner-glitch', true);
        
        // Запускаем звуковой эффект
        this.playWinnerSound();

        // Обновляем историю и статистику (без изменения главного окна)
        this.updateHistoryDisplay();
        this.updateButtonStates();
        DOMUtils.updateElementText(this.elements.remainingCount, this.state.remainingParticipants.length);

        // Объявляем победителя для screen readers
        this.announceWinner(winner);
        
        // Обновляем статус
        const remaining = this.state.remainingParticipants.length;
        if (remaining > 0) {
            this.updateStatus(`Выбрано: ${winner.name}. Осталось: ${remaining}`, 'success');
        } else {
            this.updateStatus(`Последнее демо: ${winner.name}. Все демо выбраны!`, 'warning');
            this.elements.startRandom.disabled = true;
        }

        // Убираем эффекты появления победителя
        setTimeout(() => {
            DOMUtils.updateElementClass(this.elements.currentParticipant, 'winner-reveal', false);
            DOMUtils.updateElementClass(this.elements.currentParticipant, 'winner-glitch', false);
        }, 400);
    }
    
    playWinnerSound() {
        if (!this.settings.soundEnabled) return;
        
        try {
            // Создаем простой звуковой эффект с помощью Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.3);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            Logger.warn('Could not play winner sound:', error);
        }
    }
    
    saveStateForUndo() {
        const stateSnapshot = {
            participants: [...this.state.participants],
            remainingParticipants: [...this.state.remainingParticipants],
            history: [...this.state.history],
            timestamp: Date.now()
        };
        
        this.state.undoStack.push(stateSnapshot);
        
        // Ограничиваем размер стека отмены
        if (this.state.undoStack.length > CONFIG.UNDO_LIMIT) {
            this.state.undoStack.shift();
        }

        this.updateUndoButtonState();
    }
    
    restoreState(savedState) {
        this.state.participants = [...savedState.participants];
        this.state.remainingParticipants = [...savedState.remainingParticipants];
        this.state.history = [...savedState.history];

        // Обновляем главное окно - показываем последний элемент истории или '?'
        if (this.state.history.length > 0) {
            const lastWinner = this.state.history[this.state.history.length - 1];
            DOMUtils.updateElementText(this.elements.currentParticipant, lastWinner.name);
        } else {
            DOMUtils.updateElementText(this.elements.currentParticipant, '?');
        }

        // Обновляем UI
        this.updateUI();
    }
    
    updateUndoButtonState() {
        this.elements.undoLast.disabled = this.state.undoStack.length === 0;
    }
    
    resetAll() {
        this.state.participants = [];
        this.state.remainingParticipants = [];
        this.state.history = [];
        this.state.undoStack = [];
        this.state.isRandomizing = false;

        // Сбрасываем главное окно
        DOMUtils.updateElementText(this.elements.currentParticipant, '?');
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'glitching', false);
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'pulsing', false);
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'bouncing', false);
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'winner-reveal', false);
        DOMUtils.updateElementClass(this.elements.currentParticipant, 'winner-glitch', false);
 
        this.updateUI();
        this.updateUndoButtonState();
        this.updateInputPanelState(); // Восстанавливаем начальное состояние панели

        // Очищаем поле ввода
        if (this.elements.participantCount) {
            this.elements.participantCount.value = '';
        }
    }
    
    updateUI() {
        this.uiOptimizer.queueUpdate(() => {
            DOMUtils.updateElementText(this.elements.demoCount, this.state.participants.length);
            DOMUtils.updateElementText(this.elements.remainingCount, this.state.remainingParticipants.length);
            // НЕ обновляем главное окно с текущим участником - это делается отдельно
            this.updateHistoryDisplay();
            this.updateButtonStates();
        });
    }
    
    updateButtonStates() {
        const hasRemaining = this.state.remainingParticipants.length > 0;
        this.elements.startRandom.disabled = !hasRemaining;
    }
    
    updateHistoryDisplay() {
        const container = this.elements.participantHistory;
        container.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        const reversedHistory = [...this.state.history].reverse();
        
        reversedHistory.forEach((participant, index) => {
            const li = DOMUtils.createElement('li', '', participant.id.toString());
            li.title = `${participant.name} (кликните чтобы вернуть в розыгрыш)`;
            li.setAttribute('data-participant-id', participant.id);
            
            if (index === 0) {
                li.classList.add('recent', 'pulsing');
            }
            
            // Добавляем обработчик клика для возврата в розыгрыш
            li.addEventListener('click', () => this.handleHistoryItemClick(participant.id));

            fragment.appendChild(li);
        });
        
        container.appendChild(fragment);
    }
    
    handleHistoryItemClick(participantId) {
        // Находим участника в истории
        const historyIndex = this.state.history.findIndex(p => p.id === participantId);
        if (historyIndex === -1) return;

        // Проверяем, не вернули ли его уже
        if (this.state.remainingParticipants.some(p => p.id === participantId)) {
            this.updateStatus('Этот участник уже доступен для розыгрыша!', 'warning');
            return;
        }

        // Удаляем из истории
        const participant = this.state.history.splice(historyIndex, 1)[0];

        // Возвращаем в пул доступных
        this.state.remainingParticipants.push(participant);

        // Сортируем remainingParticipants по id для порядка
        this.state.remainingParticipants.sort((a, b) => a.id - b.id);

        // Обновляем UI
        this.updateUI();
        this.updateButtonStates();

        // Показываем уведомление
        this.updateStatus(`${participant.name} возвращён в розыгрыш! Всего доступно: ${this.state.remainingParticipants.length}`, 'success');
        this.announceToScreenReader(`${participant.name} возвращён в розыгрыш`);

        Logger.info(`Participant ${participant.name} returned to pool`);
    }

    updateStatus(message, type) {
        DOMUtils.updateElementText(this.elements.statusMessage, message);
        this.elements.statusMessage.className = `status-message ${type}`;
    }
    
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
    
    announceWinner(winner) {
        const announcement = `Выбран победитель: ${winner.name}`;
        this.announceToScreenReader(announcement);
    }
    
}

// Класс для оптимизации обновлений UI
class UIOptimizer {
    constructor() {
        this.updateQueue = [];
        this.isUpdating = false;
        this.animationFrame = null;
    }
    
    queueUpdate(callback) {
        this.updateQueue.push(callback);
        if (!this.isUpdating) {
            this.processQueue();
        }
    }
    
    processQueue() {
        this.isUpdating = true;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        this.animationFrame = requestAnimationFrame(() => {
            while (this.updateQueue.length > 0) {
                const update = this.updateQueue.shift();
                try {
                    update();
                } catch (error) {
                    Logger.error('Error during UI update:', error);
                }
            }
            this.isUpdating = false;
        });
    }
}

// Глобальные обработчики событий
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация приложения
    window.app = new VimsRandomizer();
});

// Экспорт для тестирования (если нужно)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        VimsRandomizer, 
        CONFIG, 
        Logger, 
        DOMUtils, 
        ValidationUtils, 
        UIOptimizer 
    };
}

// Обработка ошибок глобально
window.addEventListener('error', (event) => {
    Logger.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    Logger.error('Unhandled promise rejection:', event.reason);
});

Logger.info('Vims-Randomizer script loaded successfully');
