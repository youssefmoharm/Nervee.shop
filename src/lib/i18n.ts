/**
 * Arabic Translation Support for NERVE
 *
 * This module provides i18n support for Arabic language with RTL layout.
 * Supports fallback to English and dynamic language switching.
 *
 * Usage:
 *
 * // In your component
 * import { useTranslation, Trans } from '../lib/i18n';
 *
 * const { t, i18n } = useTranslation();
 * const isArabic = i18n.language === 'ar';
 *
 * // In JSX
 * <h1>{t('home.title')}</h1>
 * <Trans i18nKey="home.subtitle" components={{ strong: <strong /> }} />
 *
 * // For conditional RTL
 * <div dir={isArabic ? 'rtl' : 'ltr'}>
 *   <button className={isArabic ? 'mr-4' : 'ml-4'}>...</button>
 * </div>
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Default language
export const DEFAULT_LANGUAGE = 'en';

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
  { code: 'ar', name: 'العربية', nativeName: 'Arabic', direction: 'rtl' },
];

// Language options for detector
export const languageOptions = {
  languages: SUPPORTED_LANGUAGES.map(l => l.code),
  priority: ['navigator', 'cookie', 'localStorage'],
  lookupQuerystring: 'lang',
  lookupCookie: 'nerve_lang',
  lookupLocalStorage: 'nerve_language',
  caches: ['cookie'],
  cookieMinutes: 365 * 24 * 60, // 1 year
};

// Translation resources
export const resources = {
  en: {
    translation: {
      // Navigation
      nav: {
        shop: 'Shop',
        collections: 'Collections',
        about: 'About',
        contact: 'Contact',
        cart: 'Cart',
        account: 'Account',
        myOrders: 'My Orders',
        wishlist: 'Wishlist',
        admin: 'Admin',
        search: 'Search...',
      },

      // Home
      home: {
        title: 'NERVE',
        subtitle: 'Cool but Chic | Contemporary Egyptian Concept Store',
        tagline:
          'Built around individuality, movement, and the pieces that become part of your everyday identity.',
        shopNow: 'Shop Now',
        featured: 'Featured Collections',
        newArrivals: 'New Arrivals',
        bestSellers: 'Best Sellers',
        newsletterTitle: 'Join Our Community',
        newsletterSubtitle: 'Subscribe for exclusive drops, styling tips, and early access.',
        emailPlaceholder: 'Enter your email',
        subscribe: 'Subscribe',
        footer: '© 2026 NERVE. All rights reserved.',
      },

      // Shop
      shop: {
        title: 'Shop',
        allProducts: 'All Products',
        filter: 'Filter',
        sortBy: 'Sort by',
        price: 'Price',
        size: 'Size',
        color: 'Color',
        inStock: 'In Stock',
        noResults: 'No products found',
        viewDetails: 'View Details',
        addToCart: 'Add to Cart',
        outOfStock: 'Out of Stock',
      },

      // Product Detail
      product: {
        addToCart: 'Add to Cart',
        addToWishlist: 'Add to Wishlist',
        quantity: 'Quantity',
        sizeGuide: 'Size Guide',
        share: 'Share',
        description: 'Description',
        details: 'Details',
        reviews: 'Reviews',
        similarProducts: 'Similar Products',
      },

      // Cart
      cart: {
        title: 'Your Cart',
        empty: 'Your cart is empty',
        emptySubtitle: "Looks like you haven't added anything to your cart yet.",
        continueShopping: 'Continue Shopping',
        subtotal: 'Subtotal',
        shipping: 'Shipping',
        total: 'Total',
        checkout: 'Proceed to Checkout',
        remove: 'Remove',
        updating: 'Updating...',
      },

      // Checkout
      checkout: {
        title: 'Checkout',
        shippingInfo: 'Shipping Information',
        firstName: 'First Name',
        lastName: 'Last Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        city: 'City',
        governorate: 'Governorate',
        postalCode: 'Postal Code',
        deliveryMethod: 'Delivery Method',
        standard: 'Standard (3-5 business days)',
        express: 'Express (1-2 business days)',
        paymentMethod: 'Payment Method',
        cod: 'Cash on Delivery',
        orderSummary: 'Order Summary',
        placeOrder: 'Place Order',
        processing: 'Processing...',
        success: 'Order Placed Successfully!',
      },

      // Account
      account: {
        title: 'My Account',
        profile: 'Profile',
        orders: 'My Orders',
        addresses: 'Addresses',
        wishlist: 'Wishlist',
        settings: 'Settings',
        logout: 'Logout',
      },

      // Orders
      orders: {
        title: 'My Orders',
        orderNumber: 'Order #',
        date: 'Date',
        status: 'Status',
        total: 'Total',
        viewDetails: 'View Details',
        cancelled: 'Cancelled',
        pending: 'Pending',
        processing: 'Processing',
        shipped: 'Shipped',
        delivered: 'Delivered',
      },

      // Collections
      collections: {
        title: 'Collections',
        seeAll: 'See All',
      },

      // About
      about: {
        title: 'About NERVE',
        story: 'Our Story',
        mission: 'Our Mission',
        values: 'Our Values',
      },

      // Contact
      contact: {
        title: 'Contact Us',
        name: 'Name',
        email: 'Email',
        subject: 'Subject',
        message: 'Message',
        send: 'Send Message',
        sent: 'Message sent successfully!',
      },

      // Auth
      auth: {
        login: 'Login',
        register: 'Register',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        forgotPassword: 'Forgot Password?',
        dontHaveAccount: "Don't have an account?",
        haveAccount: 'Already have an account?',
        logout: 'Logout',
      },

      // Common
      common: {
        error: 'Something went wrong',
        success: 'Operation successful',
        loading: 'Loading...',
        save: 'Save',
        cancel: 'Cancel',
        close: 'Close',
        required: 'Required',
        invalid: 'Invalid',
      },

      // Validation
      validation: {
        email: 'Please enter a valid email address',
        password: 'Password must be at least 8 characters',
        name: 'Please enter your name',
        address: 'Please enter your address',
        phone: 'Please enter a valid phone number',
      },

      // Shipping & Returns
      shipping: {
        title: 'Shipping Information',
        standard: 'Standard Shipping',
        express: 'Express Shipping',
        free: 'Free Shipping',
        estimated: 'Estimated Delivery',
        details: 'Shipping Details',
      },

      returns: {
        title: 'Returns & Exchanges',
        policy: 'Return Policy',
        process: 'How to Return',
        contact: 'Contact Us',
      },

      // Privacy & Terms
      privacy: {
        title: 'Privacy Policy',
      },
      terms: {
        title: 'Terms of Service',
      },
    },
  },
  ar: {
    translation: {
      // Navigation
      nav: {
        shop: 'تسوق',
        collections: 'المجموعات',
        about: 'من نحن',
        contact: 'اتصل بنا',
        cart: 'السلة',
        account: 'حسابي',
        myOrders: 'طلباتي',
        wishlist: 'المفضلة',
        admin: 'الإدارة',
        search: 'بحث...',
      },

      // Home
      home: {
        title: 'NERVE',
        subtitle: 'أنيق ولكن أصيل | متجر مفاهيم مصري معاصر',
        tagline: 'مصمم حول الفردية، الحركة، والقطع التي تصبح جزءًا من هويتك اليومية.',
        shopNow: 'تسوق الآن',
        featured: 'مجموعات مميزة',
        newArrivals: 'الوصل الجديد',
        bestSellers: 'الأكثر مبيعًا',
        newsletterTitle: 'انضم إلى مجتمعنا',
        newsletterSubtitle: 'اشترك للحصول على إطلاقات حصرية، نصائح أزياء، ووصول مبكر.',
        emailPlaceholder: 'أدخل بريدك الإلكتروني',
        subscribe: 'اشترك',
        footer: '© ٢٠٢٦ NERVE. جميع الحقوق محفوظة.',
      },

      // Shop
      shop: {
        title: 'تسوق',
        allProducts: 'جميع المنتجات',
        filter: 'فلتر',
        sortBy: 'ترتيب حسب',
        price: 'السعر',
        size: 'الحجم',
        color: 'اللون',
        inStock: 'متوفر',
        noResults: 'لم يتم العثور على منتجات',
        viewDetails: 'عرض التفاصيل',
        addToCart: 'أضف إلى السلة',
        outOfStock: 'نفدت الكمية',
      },

      // Product Detail
      product: {
        addToCart: 'أضف إلى السلة',
        addToWishlist: 'أضف إلى المفضلة',
        quantity: 'الكمية',
        sizeGuide: 'دليل المقاسات',
        share: 'شارك',
        description: 'الوصف',
        details: 'التفاصيل',
        reviews: 'التقييمات',
        similarProducts: 'منتجات مشابهة',
      },

      // Cart
      cart: {
        title: 'سلتك',
        empty: 'سلتك فارغة',
        emptySubtitle: 'يبدو أنك لم تضف أي شيء إلى سلتك بعد.',
        continueShopping: 'استمر في التسوق',
        subtotal: 'المجموع الفرعي',
        shipping: 'الشحن',
        total: 'الإجمالي',
        checkout: 'إتمام الطلب',
        remove: 'حذف',
        updating: 'جاري التحديث...',
      },

      // Checkout
      checkout: {
        title: 'إتمام الطلب',
        shippingInfo: 'معلومات الشحن',
        firstName: 'الاسم الأول',
        lastName: 'اسم العائلة',
        email: 'البريد الإلكتروني',
        phone: 'الهاتف',
        address: 'العنوان',
        city: 'المدينة',
        governorate: 'المحافظة',
        postalCode: 'الرمز البريدي',
        deliveryMethod: 'طريقة الشحن',
        standard: 'عادي (٣-٥ أيام عمل)',
        express: 'سريع (١-٢ يوم عمل)',
        paymentMethod: 'طريقة الدفع',
        cod: 'الدفع عند الاستلام',
        orderSummary: 'ملخص الطلب',
        placeOrder: 'وضع الطلب',
        processing: 'جاري المعالجة...',
        success: 'تم الطلب بنجاح!',
      },

      // Account
      account: {
        title: 'حسابي',
        profile: 'الملف الشخصي',
        orders: 'طلباتي',
        addresses: 'العناوين',
        wishlist: 'المفضلة',
        settings: 'الإعدادات',
        logout: 'خروج',
      },

      // Orders
      orders: {
        title: 'طلباتي',
        orderNumber: 'الرقم #',
        date: 'التاريخ',
        status: 'الحالة',
        total: 'الإجمالي',
        viewDetails: 'عرض التفاصيل',
        cancelled: 'ملغى',
        pending: 'قيد الانتظار',
        processing: 'قيد المعالجة',
        shipped: 'تم الشحن',
        delivered: 'تم التوصيل',
      },

      // Collections
      collections: {
        title: 'المجموعات',
        seeAll: 'عرض الكل',
      },

      // About
      about: {
        title: 'عن NERVE',
        story: 'قصتنا',
        mission: 'رسالتنا',
        values: 'قيمنا',
      },

      // Contact
      contact: {
        title: 'اتصل بنا',
        name: 'الاسم',
        email: 'البريد الإلكتروني',
        subject: 'الموضوع',
        message: 'الرسالة',
        send: 'إرسال الرسالة',
        sent: 'تم إرسال الرسالة بنجاح!',
      },

      // Auth
      auth: {
        login: 'تسجيل الدخول',
        register: 'تسجيل',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        confirmPassword: 'تأكيد كلمة المرور',
        forgotPassword: 'نسيت كلمة المرور؟',
        dontHaveAccount: 'ليس لديك حساب؟',
        haveAccount: 'لديك حساب بالفعل؟',
        logout: 'خروج',
      },

      // Common
      common: {
        error: 'حدث خطأ ما',
        success: 'تمت العملية بنجاح',
        loading: 'جاري التحميل...',
        save: 'حفظ',
        cancel: 'إلغاء',
        close: 'إغلاق',
        required: 'إجباري',
        invalid: 'غير صالح',
      },

      // Validation
      validation: {
        email: 'يرجى إدخال بريد إلكتروني صالح',
        password: 'يجب أن تكون كلمة المرور ٨ أحرف على الأقل',
        name: 'يرجى إدخال اسمك',
        address: 'يرجى إدخال عنوانك',
        phone: 'يرجى إدخال رقم هاتف صالح',
      },

      // Shipping & Returns
      shipping: {
        title: 'معلومات الشحن',
        standard: 'شحن عادي',
        express: 'شحن سريع',
        free: 'شحن مجاني',
        estimated: 'التوصيل المتوقع',
        details: 'تفاصيل الشحن',
      },

      returns: {
        title: 'الإرجاع والاستبدال',
        policy: 'سياسة الإرجاع',
        process: 'كيفية الإرجاع',
        contact: 'اتصل بنا',
      },

      // Privacy & Terms
      privacy: {
        title: 'سياسة الخصوصية',
      },
      terms: {
        title: 'شروط الخدمة',
      },
    },
  },
};

// Initialize i18n
i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    lng: DEFAULT_LANGUAGE,
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: languageOptions,
    backend: {
      loadPath: '/locales/{{lng}}.json',
    },
  });

// Export for use in components
export default i18n;

// Hook for React components
export const useTranslation = () => {
  return {
    t: i18n.getFixedT(i18n.language, 'translation'),
    i18n,
    language: i18n.language,
    isRTL: i18n.language === 'ar',
  };
};

// Helper to get current language direction
export function getDirection(lang?: string): 'ltr' | 'rtl' {
  return (lang || i18n.language) === 'ar' ? 'rtl' : 'ltr';
}

// Helper to format Arabic numbers
export function arabicNumbers(str: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/\d/g, d => arabicDigits[parseInt(d)] || d);
}

// Helper to format English numbers
export function englishNumbers(str: string): string {
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return str.replace(/[٠-٩]/g, d => englishDigits['٠١٢٣٤٥٦٧٨٩'.indexOf(d)] || d);
}

// Type exports
export type TranslationKey = keyof (typeof resources)['en']['translation'];
export type NestedKey<T> = T extends object
  ? {
      [K in keyof T & (string | number)]: T[K] extends object ? `${K}.${NestedKey<T[K]>}` : `${K}`;
    }[keyof T & (string | number)]
  : string;
