// Centralized interval management to prevent memory leaks
class IntervalManager {
    constructor() {
        this.intervals = new Map();
        this.setupCleanup();
    }

    // Set an interval with automatic cleanup
    setInterval(key, callback, delay) {
        // Clear existing interval if it exists
        this.clearInterval(key);
        
        const intervalId = setInterval(callback, delay);
        this.intervals.set(key, intervalId);
        
        return intervalId;
    }

    // Clear a specific interval
    clearInterval(key) {
        const intervalId = this.intervals.get(key);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(key);
        }
    }

    // Clear all intervals
    clearAll() {
        this.intervals.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        this.intervals.clear();
    }

    // Get active interval count
    getActiveCount() {
        return this.intervals.size;
    }

    // Setup automatic cleanup on page unload
    setupCleanup() {
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.clearAll();
        });

        // Cleanup when page becomes hidden to save resources
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Pause non-critical intervals when page is hidden
                this.pauseNonCritical();
            } else {
                // Resume intervals when page becomes visible
                this.resumeAll();
            }
        });

        // Cleanup on errors
        window.addEventListener('error', () => {
            console.warn('Error detected, cleaning up intervals');
            this.clearAll();
        });
    }

    // Pause non-critical intervals (keep only essential ones)
    pauseNonCritical() {
        const criticalKeys = ['session-keepalive'];
        this.intervals.forEach((intervalId, key) => {
            if (!criticalKeys.includes(key)) {
                clearInterval(intervalId);
                this.intervals.delete(key);
            }
        });
    }

    // Resume all intervals (to be called when page becomes visible)
    resumeAll() {
        // This should be implemented by each page to restart their specific intervals
        window.dispatchEvent(new CustomEvent('resume-intervals'));
    }
}

// Create global instance
window.intervalManager = new IntervalManager();

export default window.intervalManager;
