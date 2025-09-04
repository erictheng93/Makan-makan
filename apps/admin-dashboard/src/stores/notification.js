import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
export const useNotificationStore = defineStore('notification', () => {
    const notifications = ref([]);
    const soundEnabled = ref(true);
    const unreadCount = computed(() => notifications.value.filter(n => !n.read).length);
    const addNotification = (notification) => {
        const newNotification = {
            ...notification,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            createdAt: new Date(),
            read: false
        };
        notifications.value.unshift(newNotification);
        // Play sound if enabled
        if (notification.sound && soundEnabled.value) {
            playNotificationSound(notification.type);
        }
        // Auto remove non-persistent notifications after 5 seconds
        if (!notification.persistent) {
            setTimeout(() => {
                removeNotification(newNotification.id);
            }, 5000);
        }
        return newNotification.id;
    };
    const removeNotification = (id) => {
        const index = notifications.value.findIndex(n => n.id === id);
        if (index > -1) {
            notifications.value.splice(index, 1);
        }
    };
    const markAsRead = (id) => {
        const notification = notifications.value.find(n => n.id === id);
        if (notification) {
            notification.read = true;
        }
    };
    const markAllAsRead = () => {
        notifications.value.forEach(n => {
            n.read = true;
        });
    };
    const clearAll = () => {
        notifications.value = [];
    };
    const clearRead = () => {
        notifications.value = notifications.value.filter(n => !n.read);
    };
    const toggleSound = () => {
        soundEnabled.value = !soundEnabled.value;
        localStorage.setItem('notification_sound', soundEnabled.value.toString());
    };
    const playNotificationSound = (type) => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Different frequencies for different notification types
            const frequencies = {
                success: 880,
                info: 660,
                warning: 554,
                error: 440,
                order_ready: 880,
                order_urgent: 554
            };
            const frequency = frequencies[type];
            const duration = 0.2;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        }
        catch (error) {
            console.warn('Could not play notification sound:', error);
        }
    };
    // Initialize sound setting from localStorage
    const initializeSoundSetting = () => {
        const saved = localStorage.getItem('notification_sound');
        if (saved !== null) {
            soundEnabled.value = saved === 'true';
        }
    };
    // Shorthand methods for common notification types
    const success = (title, message, options) => {
        return addNotification({ type: 'success', title, message, ...options });
    };
    const error = (title, message, options) => {
        return addNotification({ type: 'error', title, message, persistent: true, ...options });
    };
    const warning = (title, message, options) => {
        return addNotification({ type: 'warning', title, message, ...options });
    };
    const info = (title, message, options) => {
        return addNotification({ type: 'info', title, message, ...options });
    };
    return {
        notifications: readonly(notifications),
        unreadCount,
        soundEnabled: readonly(soundEnabled),
        addNotification,
        removeNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        clearRead,
        toggleSound,
        initializeSoundSetting,
        success,
        error,
        warning,
        info
    };
});
