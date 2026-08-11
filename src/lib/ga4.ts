/**
 * GA4 Analytics Service
 * 
 * Provides typed helpers for Google Analytics 4 event tracking.
 * Requires VITE_GA_ID environment variable to be set.
 */

declare global {
    interface Window {
        gtag?: (...args: any[]) => void
    }
}

// GA4 Event Parameters
export interface GA4EventParameters {
    [key: string]: string | number | boolean | undefined
}

export interface GA4Item {
    item_id: string
    item_name?: string
    item_category?: string
    price?: number
    quantity?: number
}

export interface GA4EcommerceParameters {
    items?: GA4Item[]
    value?: number
    currency?: string
    transaction_id?: string
    shipping?: number
    tax?: number
    coupon?: string
}

// Initialize GA4
export function initGA4() {
    const gaId = import.meta.env.VITE_GA_ID

    if (!gaId) {
        console.warn('GA4: Google Analytics ID not configured. Add VITE_GA_ID to environment.')
        return false
    }

    // Check if gtag already loaded
    if (window.gtag) {
        console.log('GA4: Already initialized')
        return true
    }

    // Load GA4 script
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
    document.head.appendChild(script)

    // Initialize gtag
    window.gtag = function (...args: unknown[]) {
        ; (window as any).dataLayer = (window as any).dataLayer || []
            ; ((window as any).dataLayer as any[]).push(...args)
    }

    window.gtag('js', new Date())
    window.gtag('config', gaId, {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
    })

    console.log('GA4: Initialized with ID', gaId)
    return true
}

// Send a custom event
export function sendEvent(eventName: string, params: GA4EventParameters = {}) {
    if (!window.gtag) {
        if (import.meta.env.DEV) {
            console.log('GA4: Event skipped (not initialized)', eventName, params)
        }
        return
    }

    window.gtag('event', eventName, params)

    if (import.meta.env.DEV) {
        console.log('GA4: Event sent', eventName, params)
    }
}

// E-commerce events
export const ecommerce = {
    // View item (product detail)
    viewItem: (itemId: string, itemName: string, category: string, price: number) => {
        sendEvent('view_item', {
            items: [{
                item_id: itemId,
                item_name: itemName,
                item_category: category,
                price,
            }],
            currency: 'EGP',
            value: price,
        })
    },

    // Add to cart
    addToCart: (itemId: string, itemName: string, category: string, price: number, quantity: number = 1) => {
        sendEvent('add_to_cart', {
            items: [{
                item_id: itemId,
                item_name: itemName,
                item_category: category,
                price,
                quantity,
            }],
            currency: 'EGP',
            value: price * quantity,
        })
    },

    // Remove from cart
    removeFromCart: (itemId: string, itemName: string, category: string, price: number, quantity: number = 1) => {
        sendEvent('remove_from_cart', {
            items: [{
                item_id: itemId,
                item_name: itemName,
                item_category: category,
                price,
                quantity,
            }],
            currency: 'EGP',
            value: price * quantity,
        })
    },

    // View cart
    viewCart: (value: number) => {
        sendEvent('view_cart', {
            currency: 'EGP',
            value,
        })
    },

    // Begin checkout
    beginCheckout: (value: number, coupon?: string) => {
        sendEvent('begin_checkout', {
            currency: 'EGP',
            value,
            coupon,
        })
    },

    // Purchase (transaction)
    purchase: (transactionId: string, value: number, coupon?: string, shipping?: number, tax?: number) => {
        sendEvent('purchase', {
            transaction_id: transactionId,
            value,
            currency: 'EGP',
            coupon,
            shipping,
            tax,
        })
    },

    // Select item (for product list impressions)
    selectItem: (itemId: string, itemName: string, category: string, price: number, listName: string, listItemPosition: number) => {
        sendEvent('select_item', {
            items: [{
                item_id: itemId,
                item_name: itemName,
                item_category: category,
                price,
                item_list_name: listName,
                item_list_id: 'list_' + listName.toLowerCase().replace(/\s+/g, '_'),
                index: listItemPosition,
            }],
            currency: 'EGP',
            value: price,
        })
    },

    // Search
    search: (searchTerm: string, resultCount?: number) => {
        sendEvent('search', {
            search_term: searchTerm,
            number_of_results: resultCount,
        })
    },
}

// User engagement events
export const engagement = {
    // Session start
    sessionStart: () => {
        sendEvent('session_start', {})
    },

    // Scroll (track when user scrolls 25%, 50%, 75%, 100%)
    scroll: (percentage: number) => {
        sendEvent('scroll', {
            scroll_percentage: percentage,
        })
    },

    // Click
    click: (elementId: string, elementType: string, elementText: string) => {
        sendEvent('click', {
            element_id: elementId,
            element_type: elementType,
            element_text: elementText,
        })
    },

    // Select content
    selectContent: (contentType: string, contentId?: string) => {
        sendEvent('select_content', {
            content_type: contentType,
            content_id: contentId,
        })
    },
}

// Page view tracking
export function trackPageView(pageTitle: string, pagePath?: string) {
    if (!window.gtag) {
        if (import.meta.env.DEV) {
            console.log('GA4: Page view skipped (not initialized)', pageTitle, pagePath)
        }
        return
    }

    window.gtag('event', 'page_view', {
        page_title: pageTitle,
        page_location: window.location.href,
        page_path: pagePath || window.location.pathname,
    })
}

// Custom dimensions/metrics
export function setUserProperty(name: string, value: string | number | boolean) {
    if (!window.gtag) {
        if (import.meta.env.DEV) {
            console.log('GA4: User property skipped (not initialized)', name, value)
        }
        return
    }

    window.gtag('set', 'user_properties', {
        [name]: value,
    })
}

// User ID tracking
export function setUserId(userId: string) {
    if (!window.gtag) {
        if (import.meta.env.DEV) {
            console.log('GA4: User ID skipped (not initialized)', userId)
        }
        return
    }

    window.gtag('set', 'user_id', userId)
}

// Clear user ID (on logout)
export function clearUserId() {
    if (!window.gtag) {
        if (import.meta.env.DEV) {
            console.log('GA4: User ID clear skipped (not initialized)')
        }
        return
    }

    window.gtag('set', 'user_id', null)
}
