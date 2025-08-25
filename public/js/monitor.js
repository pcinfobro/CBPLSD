// Client-side performance monitoring
(function() {
    'use strict';

    class PerformanceMonitor {
        constructor() {
            this.metrics = {
                pageLoad: null,
                memoryUsage: [],
                intervalCount: 0,
                requestCount: 0,
                errors: 0
            };
            this.startTime = performance.now();
            this.setupMonitoring();
        }

        setupMonitoring() {
            // Monitor page load time
            window.addEventListener('load', () => {
                this.metrics.pageLoad = performance.now() - this.startTime;
                console.log(`📊 Page loaded in ${this.metrics.pageLoad.toFixed(2)}ms`);
            });

            // Monitor memory usage (if available)
            if ('memory' in performance) {
                setInterval(() => {
                    const memory = performance.memory;
                    this.metrics.memoryUsage.push({
                        used: memory.usedJSHeapSize,
                        total: memory.totalJSHeapSize,
                        limit: memory.jsHeapSizeLimit,
                        timestamp: Date.now()
                    });

                    // Keep only last 10 entries
                    if (this.metrics.memoryUsage.length > 10) {
                        this.metrics.memoryUsage.shift();
                    }

                    // Warn if memory usage is high
                    const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
                    if (usagePercent > 80) {
                        console.warn(`⚠️ High memory usage: ${usagePercent.toFixed(1)}%`);
                        this.cleanupMemory();
                    }
                }, 30000); // Check every 30 seconds
            }

            // Monitor errors
            window.addEventListener('error', () => {
                this.metrics.errors++;
                if (this.metrics.errors > 5) {
                    console.warn('⚠️ Multiple errors detected, cleaning up resources');
                    this.cleanupMemory();
                }
            });

            // Display metrics in console every 2 minutes
            setInterval(() => {
                this.displayMetrics();
            }, 120000);
        }

        cleanupMemory() {
            // Force cleanup of intervals
            if (window.intervalManager) {
                const counts = window.intervalManager.getActiveCount();
                console.log('🧹 Cleaning up resources. Active timers:', counts);
                
                // Keep only essential intervals
                const essential = ['balance-refresh', 'session-keepalive'];
                window.intervalManager.intervals.forEach((id, key) => {
                    if (!essential.includes(key)) {
                        window.intervalManager.clearInterval(key);
                    }
                });
            }

            // Clear caches
            if (window.cacheManager) {
                window.cacheManager.clear();
            }

            // Clear pending requests
            if (window.requestManager) {
                window.requestManager.clearPending();
            }

            console.log('✅ Memory cleanup completed');
        }

        displayMetrics() {
            console.group('📊 Performance Metrics');
            
            if (this.metrics.pageLoad) {
                console.log(`Page Load Time: ${this.metrics.pageLoad.toFixed(2)}ms`);
            }
            
            if (window.intervalManager) {
                const counts = window.intervalManager.getActiveCount();
                console.log(`Active Intervals: ${counts.intervals}`);
                console.log(`Active Timeouts: ${counts.timeouts}`);
            }
            
            console.log(`Total Errors: ${this.metrics.errors}`);
            
            if (this.metrics.memoryUsage.length > 0) {
                const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
                const usedMB = (latest.used / 1024 / 1024).toFixed(1);
                const totalMB = (latest.total / 1024 / 1024).toFixed(1);
                console.log(`Memory Usage: ${usedMB}MB / ${totalMB}MB`);
            }
            
            console.groupEnd();
        }

        // Manual cleanup function for debugging
        forceCleanup() {
            this.cleanupMemory();
            this.metrics.errors = 0;
            console.log('🔧 Manual cleanup performed');
        }
    }

    // Initialize monitor
    window.performanceMonitor = new PerformanceMonitor();

    // Add manual cleanup function to console
    window.cleanupApp = () => {
        window.performanceMonitor.forceCleanup();
    };

    console.log('🔍 Performance monitor initialized. Use cleanupApp() to manually cleanup resources.');

})();
