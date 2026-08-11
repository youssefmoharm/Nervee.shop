import { useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { initGA4, trackPageView, setUserProperty, setUserId, clearUserId } from '../lib/ga4'
import type { EcommerceEvent } from '../lib/analytics'

/**
 * Custom hook for GA4 tracking
 * 
 * Usage:
 * - Automatically tracks page views on route changes
 * - Provides helper methods for custom events
 * - Integrates with auth state for user tracking
 */
export function useGA4() {
    const location = useLocation()
    const initialized = useRef(false)

    // Initialize GA4 on mount
    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true
            initGA4()
        }
    }, [])

    // Track page views on route changes
    useEffect(() => {
        const pagePath = location.pathname + location.search

        // Only track main routes, not modal routes or fragments
        if (!pagePath.includes('#') && pagePath !== '/cart' && pagePath !== '/guest-order') {
            trackPageView(document.title, pagePath)
        }
    }, [location])

    // User tracking helpers
    const trackUserLogin = useCallback((userId: string, email?: string) => {
        setUserId(userId)
        if (email) {
            setUserProperty('email', email)
            setUserProperty('user_type', 'authenticated')
        }
    }, [])

    const trackUserLogout = useCallback(() => {
        clearUserId()
        setUserProperty('user_type', 'guest')
    }, [])

    // Page tracking helper
    const trackPage = useCallback((pageTitle: string) => {
        trackPageView(pageTitle)
    }, [])

    // E-commerce event helpers
    const trackEcommerce = useCallback((event: EcommerceEvent) => {
        const { event_name, ...parameters } = event

        if (!window.gtag) return

        window.gtag('event', event_name, {
            currency: 'EGP',
            ...parameters,
        })

        if (import.meta.env.DEV) {
            console.log('GA4 E-commerce Event:', event_name, parameters)
        }
    }, [])

    // Custom event helper
    const trackCustomEvent = useCallback((eventName: string, params?: Record<string, any>) => {
        if (!window.gtag) return

        window.gtag('event', eventName, params)

        if (import.meta.env.DEV) {
            console.log('GA4 Custom Event:', eventName, params)
        }
    }, [])

    return {
        // Methods
        trackPage,
        trackEcommerce,
        trackCustomEvent,
        trackUserLogin,
        trackUserLogout,

        // State
        isInitialized: initialized.current,
    }
}

// Hook for product detail page
export function useProductPageTracking(productId: string, productName: string, category: string, price: number) {
    useEffect(() => {
        if (productId) {
            window.gtag?.('event', 'view_item', {
                items: [{
                    item_id: productId,
                    item_name: productName,
                    item_category: category,
                    price,
                }],
                currency: 'EGP',
                value: price,
            })
        }
    }, [productId, productName, category, price])
}

// Hook for cart page
export function useCartPageTracking(subtotal: number) {
    useEffect(() => {
        window.gtag?.('event', 'view_cart', {
            currency: 'EGP',
            value: subtotal,
        })
    }, [subtotal])
}

// Hook for checkout page
export function useCheckoutPageTracking(subtotal: number, step: number) {
    useEffect(() => {
        if (step === 1) {
            window.gtag?.('event', 'begin_checkout', {
                currency: 'EGP',
                value: subtotal,
            })
        }
    }, [subtotal, step])
}

// Hook for purchase completion
export function usePurchaseTracking(orderId: string, value: number, items: { id: string; name: string; category: string; price: number; quantity: number }[]) {
    useEffect(() => {
        window.gtag?.('event', 'purchase', {
            transaction_id: orderId,
            value,
            currency: 'EGP',
            items: items.map(item => ({
                item_id: item.id,
                item_name: item.name,
                item_category: item.category,
                price: item.price,
                quantity: item.quantity,
            })),
        })
    }, [orderId, value, items])
}
