/* 
 * Client-side performance and memory management
 * Include this script in your layout.ejs to fix browser responsiveness issues
 */

(function() {
    'use strict';

    // Centralized interval management
    class IntervalManager {
        constructor() {
            this.intervals = new Map();
            this.timeouts = new Map();
            this.setupCleanup();
        }

        setInterval(key, callback, delay) {
            this.clearInterval(key);
            const id = setInterval(callback, delay);
            this.intervals.set(key, id);
            return id;
        }

        setTimeout(key, callback, delay) {
            this.clearTimeout(key);
            const id = setTimeout(() => {
                this.timeouts.delete(key);
                callback();
            }, delay);
            this.timeouts.set(key, id);
            return id;
        }

        clearInterval(key) {
            const id = this.intervals.get(key);
            if (id) {
                clearInterval(id);
                this.intervals.delete(key);
            }
        }

        clearTimeout(key) {
            const id = this.timeouts.get(key);
            if (id) {
                clearTimeout(id);
                this.timeouts.delete(key);
            }
        }

        clearAll() {
            this.intervals.forEach(id => clearInterval(id));
            this.timeouts.forEach(id => clearTimeout(id));
            this.intervals.clear();
            this.timeouts.clear();
        }

        getActiveCount() {
            return {
                intervals: this.intervals.size,
                timeouts: this.timeouts.size
            };
        }

        setupCleanup() {
            // Clean up on page unload
            window.addEventListener('beforeunload', () => {
                this.clearAll();
            });

            // Pause intervals when page is hidden to save resources
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    window.dispatchEvent(new CustomEvent('page-hidden'));
                } else {
                    window.dispatchEvent(new CustomEvent('page-visible'));
                    // Small delay to ensure page is fully visible
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('resume-intervals'));
                    }, 100);
                }
            });

            // Clean up on errors
            window.addEventListener('error', () => {
                console.warn('JavaScript error detected, cleaning up intervals');
                this.clearAll();
            });

            // Memory cleanup every 5 minutes
            this.setInterval('memory-cleanup', () => {
                this.performMemoryCleanup();
            }, 300000);
        }

        performMemoryCleanup() {
            // Clear any stale references
            if (window.jQuery) {
                window.jQuery.cleanData([]);
            }
            
            // Force garbage collection if available (development only)
            if (window.gc && typeof window.gc === 'function') {
                try {
                    window.gc();
                } catch (e) {
                    // Ignore errors
                }
            }

            console.log('Memory cleanup performed. Active intervals:', this.getActiveCount());
        }
    }

    // Cache management
    class CacheManager {
        constructor() {
            this.cache = new Map();
            this.maxSize = 50; // Maximum cache entries
            this.maxAge = 300000; // 5 minutes
        }

        set(key, value) {
            // Remove old entries if cache is full
            if (this.cache.size >= this.maxSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            this.cache.set(key, {
                value,
                timestamp: Date.now()
            });
        }

        get(key) {
            const entry = this.cache.get(key);
            if (!entry) return null;

            // Check if entry is expired
            if (Date.now() - entry.timestamp > this.maxAge) {
                this.cache.delete(key);
                return null;
            }

            return entry.value;
        }

        clear() {
            this.cache.clear();
        }

        cleanup() {
            const now = Date.now();
            for (const [key, entry] of this.cache.entries()) {
                if (now - entry.timestamp > this.maxAge) {
                    this.cache.delete(key);
                }
            }
        }
    }

    // Request manager to prevent duplicate requests
    class RequestManager {
        constructor() {
            this.pendingRequests = new Map();
        }

        async makeRequest(url, options = {}) {
            const key = `${options.method || 'GET'}-${url}`;
            
            // If request is already pending, return the existing promise
            if (this.pendingRequests.has(key)) {
                return this.pendingRequests.get(key);
            }

            const promise = fetch(url, options).finally(() => {
                this.pendingRequests.delete(key);
            });

            this.pendingRequests.set(key, promise);
            return promise;
        }

        clearPending() {
            this.pendingRequests.clear();
        }
    }

    // Initialize global managers
    window.intervalManager = new IntervalManager();
    window.cacheManager = new CacheManager();
    window.requestManager = new RequestManager();

    // Enhanced fetch function with caching and deduplication
    window.cachedFetch = async function(url, options = {}) {
        const cacheKey = `${options.method || 'GET'}-${url}`;
        
        // Try cache first for GET requests
        if (!options.method || options.method === 'GET') {
            const cached = window.cacheManager.get(cacheKey);
            if (cached) {
                return Promise.resolve(cached);
            }
        }

        try {
            const response = await window.requestManager.makeRequest(url, options);
            const data = await response.json();
            
            // Cache successful GET responses
            if (response.ok && (!options.method || options.method === 'GET')) {
                window.cacheManager.set(cacheKey, data);
            }
            
            return data;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    };

    // Global error handler
    window.addEventListener('error', function(event) {
        console.error('Global error:', event.error);
        // Clean up resources on error
        window.intervalManager.clearAll();
        window.requestManager.clearPending();
    });

    // Clean up caches periodically
    window.intervalManager.setInterval('cache-cleanup', () => {
        window.cacheManager.cleanup();
    }, 60000); // Every minute

    // Initialize message for debugging
    console.log('Performance enhancement script loaded. Active managers:', {
        intervalManager: !!window.intervalManager,
        cacheManager: !!window.cacheManager,
        requestManager: !!window.requestManager
    });

})();
