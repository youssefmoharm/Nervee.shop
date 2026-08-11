/**
 * Performance Monitoring & Optimization
 * 
 * Track Core Web Vitals, API performance, and user experience metrics
 */

import { trackEvent } from './analytics'

// Performance metrics interface
interface PerformanceMetrics {
  lcp?: number        // Largest Contentful Paint
  fid?: number        // First Input Delay
  cls?: number        // Cumulative Layout Shift
  fcp?: number        // First Contentful Paint
  ttfb?: number       // Time to First Byte
}

// API performance tracking
interface APIPerformance {
  endpoint: string
  method: string
  duration: number
  status: number
  success: boolean
}

// Memory usage tracking
interface MemoryMetrics {
  usedHeap: number
  totalHeap: number
  heapLimit: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {}
  private apiCalls: APIPerformance[] = []
  private readonly reportingInterval = 30000 // 30 seconds
  private intervalId?: number

  constructor() {
    this.init()
  }

  private init() {
    // Start monitoring when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.startMonitoring())
    } else {
      this.startMonitoring()
    }
  }

  private startMonitoring() {
    this.trackNavigationTiming()
    this.trackWebVitals()
    this.trackResourceTiming()
    this.trackMemoryUsage()
    this.startPeriodicReporting()
  }

  // Track navigation timing
  private trackNavigationTiming() {
    if (!window.performance || !performance.getEntriesByType) return

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

    if (navigation) {
      const metrics = {
        ttfb: Math.round(navigation.responseStart - navigation.requestStart),
        domLoad: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
        pageLoad: Math.round(navigation.loadEventEnd - navigation.fetchStart),
        dnsLookup: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
        tcpConnect: Math.round(navigation.connectEnd - navigation.connectStart),
        serverResponse: Math.round(navigation.responseEnd - navigation.responseStart),
      }

      this.metrics.ttfb = metrics.ttfb

      // Report navigation timing
      trackEvent('navigation_timing', metrics)

      // Alert on slow performance
      if (metrics.pageLoad > 5000) {
        this.reportSlowPage(metrics.pageLoad)
      }
    }
  }

  // Track Core Web Vitals
  private trackWebVitals() {
    if (!window.PerformanceObserver) return

    // Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as any
        
        const lcp = Math.round(lastEntry.startTime)
        this.metrics.lcp = lcp

        const rating = this.getLCPRating(lcp)
        
        trackEvent('core_web_vital_lcp', {
          value: lcp,
          rating,
          url: window.location.pathname,
        })
      })
      
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch (error) {
      console.warn('LCP observer failed:', error)
    }

    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fid = Math.round((entry as any).processingStart - entry.startTime)
          this.metrics.fid = fid

          const rating = this.getFIDRating(fid)
          
          trackEvent('core_web_vital_fid', {
            value: fid,
            rating,
            url: window.location.pathname,
          })
        }
      })
      
      fidObserver.observe({ type: 'first-input', buffered: true })
    } catch (error) {
      console.warn('FID observer failed:', error)
    }

    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as any
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value
          }
        }
        
        this.metrics.cls = clsValue

        const rating = this.getCLSRating(clsValue)
        
        trackEvent('core_web_vital_cls', {
          value: Math.round(clsValue * 1000) / 1000,
          rating,
          url: window.location.pathname,
        })
      })
      
      clsObserver.observe({ type: 'layout-shift', buffered: true })
    } catch (error) {
      console.warn('CLS observer failed:', error)
    }

    // First Contentful Paint (FCP)
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fcp = Math.round(entry.startTime)
          this.metrics.fcp = fcp

          const rating = this.getFCPRating(fcp)
          
          trackEvent('core_web_vital_fcp', {
            value: fcp,
            rating,
            url: window.location.pathname,
          })
        }
      })
      
      fcpObserver.observe({ type: 'paint', buffered: true })
    } catch (error) {
      console.warn('FCP observer failed:', error)
    }
  }

  // Track resource loading performance
  private trackResourceTiming() {
    if (!window.performance || !performance.getEntriesByType) return

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    
    // Group by resource type
    const resourceMetrics = {
      images: [],
      scripts: [],
      stylesheets: [],
      api: [],
    } as any

    resources.forEach(resource => {
      const duration = Math.round(resource.responseEnd - resource.requestStart)
      const size = resource.transferSize || 0

      if (resource.name.includes('/api/') || resource.name.includes('.supabase.')) {
        resourceMetrics.api.push({ url: resource.name, duration, size })
      } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        resourceMetrics.images.push({ url: resource.name, duration, size })
      } else if (resource.name.match(/\.js$/i)) {
        resourceMetrics.scripts.push({ url: resource.name, duration, size })
      } else if (resource.name.match(/\.css$/i)) {
        resourceMetrics.stylesheets.push({ url: resource.name, duration, size })
      }
    })

    // Report slow resources
    Object.entries(resourceMetrics).forEach(([type, resources]) => {
      (resources as any[]).forEach(resource => {
        if (resource.duration > 2000) { // > 2 seconds
          trackEvent('slow_resource', {
            type,
            url: resource.url,
            duration: resource.duration,
            size: resource.size,
          })
        }
      })
    })
  }

  // Track memory usage
  private trackMemoryUsage() {
    if (!(performance as any).memory) return

    const memory = (performance as any).memory as MemoryMetrics
    
    const memoryMetrics = {
      usedHeap: Math.round(memory.usedHeap / 1048576), // Convert to MB
      totalHeap: Math.round(memory.totalHeap / 1048576),
      heapLimit: Math.round(memory.heapLimit / 1048576),
      usagePercentage: Math.round((memory.usedHeap / memory.heapLimit) * 100),
    }

    // Alert on high memory usage
    if (memoryMetrics.usagePercentage > 80) {
      trackEvent('high_memory_usage', memoryMetrics)
    }
  }

  // API call tracking
  trackAPICall(endpoint: string, method: string, startTime: number, status: number) {
    const duration = Math.round(performance.now() - startTime)
    const success = status >= 200 && status < 400

    const apiPerformance: APIPerformance = {
      endpoint,
      method,
      duration,
      status,
      success,
    }

    this.apiCalls.push(apiPerformance)

    // Track in analytics
    trackEvent('api_performance', {
      endpoint,
      method,
      duration,
      status,
      success,
    })

    // Alert on slow API calls
    if (duration > 3000) { // > 3 seconds
      this.reportSlowAPI(apiPerformance)
    }

    // Alert on API errors
    if (!success) {
      this.reportAPIError(apiPerformance)
    }

    return apiPerformance
  }

  // Periodic reporting
  private startPeriodicReporting() {
    this.intervalId = window.setInterval(() => {
      this.reportMetrics()
    }, this.reportingInterval)
  }

  // Report current metrics
  private reportMetrics() {
    if (Object.keys(this.metrics).length === 0) return

    trackEvent('performance_summary', {
      lcp: this.metrics.lcp,
      fid: this.metrics.fid,
      cls: this.metrics.cls,
      fcp: this.metrics.fcp,
      ttfb: this.metrics.ttfb,
      url: window.location.pathname,
      timestamp: Date.now(),
    })

    // Report API performance summary
    if (this.apiCalls.length > 0) {
      const avgDuration = this.apiCalls.reduce((sum, call) => sum + call.duration, 0) / this.apiCalls.length
      const errorRate = this.apiCalls.filter(call => !call.success).length / this.apiCalls.length

      trackEvent('api_performance_summary', {
        averageDuration: Math.round(avgDuration),
        errorRate: Math.round(errorRate * 100),
        totalCalls: this.apiCalls.length,
        url: window.location.pathname,
      })

      // Clear API calls for next period
      this.apiCalls = []
    }
  }

  // Performance ratings
  private getLCPRating(lcp: number): 'good' | 'needs-improvement' | 'poor' {
    if (lcp <= 2500) return 'good'
    if (lcp <= 4000) return 'needs-improvement'
    return 'poor'
  }

  private getFIDRating(fid: number): 'good' | 'needs-improvement' | 'poor' {
    if (fid <= 100) return 'good'
    if (fid <= 300) return 'needs-improvement'
    return 'poor'
  }

  private getCLSRating(cls: number): 'good' | 'needs-improvement' | 'poor' {
    if (cls <= 0.1) return 'good'
    if (cls <= 0.25) return 'needs-improvement'
    return 'poor'
  }

  private getFCPRating(fcp: number): 'good' | 'needs-improvement' | 'poor' {
    if (fcp <= 1800) return 'good'
    if (fcp <= 3000) return 'needs-improvement'
    return 'poor'
  }

  // Alert methods
  private reportSlowPage(loadTime: number) {
    trackEvent('slow_page_load', {
      loadTime,
      url: window.location.pathname,
      userAgent: navigator.userAgent,
    })
  }

  private reportSlowAPI(apiCall: APIPerformance) {
    trackEvent('slow_api_call', {
      ...apiCall,
      url: window.location.pathname,
    })
  }

  private reportAPIError(apiCall: APIPerformance) {
    trackEvent('api_error', {
      ...apiCall,
      url: window.location.pathname,
    })
  }

  // Cleanup
  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }
}

// Global instance
let performanceMonitor: PerformanceMonitor

// Initialize performance monitoring
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return

  performanceMonitor = new PerformanceMonitor()
}

// Track API performance (for use in API calls)
export function trackAPIPerformance(endpoint: string, method: string, startTime: number, status: number) {
  if (!performanceMonitor) return
  return performanceMonitor.trackAPICall(endpoint, method, startTime, status)
}

// React hook to track component performance
export function useComponentPerformance(componentName: string) {
  const startTime = performance.now()

  return {
    // Call this when component finishes rendering
    onRenderComplete: () => {
      const renderTime = performance.now() - startTime
      
      trackEvent('component_render_time', {
        component: componentName,
        renderTime: Math.round(renderTime),
        url: window.location.pathname,
      })

      // Alert on slow renders
      if (renderTime > 100) { // > 100ms
        trackEvent('slow_component_render', {
          component: componentName,
          renderTime: Math.round(renderTime),
          url: window.location.pathname,
        })
      }
    },
  }
}

// Track user interaction performance
export function trackInteractionPerformance(interactionType: string, startTime: number) {
  const duration = performance.now() - startTime
  
  trackEvent('interaction_performance', {
    type: interactionType,
    duration: Math.round(duration),
    url: window.location.pathname,
  })

  // Alert on slow interactions
  if (duration > 500) { // > 500ms
    trackEvent('slow_interaction', {
      type: interactionType,
      duration: Math.round(duration),
      url: window.location.pathname,
    })
  }
}

// Export the monitor instance for advanced usage
export { performanceMonitor }