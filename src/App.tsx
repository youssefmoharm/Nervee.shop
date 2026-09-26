import { Suspense, lazy, useState, useEffect } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Loader from './components/Loader';
import SimpleSkeleton from './components/SimpleSkeleton';
import CartDrawer from './components/CartDrawer';
import SearchOverlay from './components/SearchOverlay';
import ProductQuickView from './components/ProductQuickView';
import ChatbotAI, { ChatbotAITrigger } from './components/ChatbotAI';
import CrispChat from './components/CrispChat';
import CookieConsent, { getCookieConsent } from './components/CookieConsent';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { ErrorBoundary, ErrorFallback } from './components/ErrorBoundary';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { BrowsingHistoryProvider } from './context/BrowsingHistoryContext';
import { ToastProvider } from './context/ToastContext';
import { QuickViewProvider } from './context/QuickViewContext';
import { ComparisonProvider } from './context/ComparisonContext';
import ComparisonWidget from './components/ComparisonWidget';
import FloatingDock from './components/FloatingDock';
import { initSentry, trackError } from './lib/sentry';
import { initAnalytics, usePageTracking } from './lib/analytics';
import { initPerformanceMonitoring } from './lib/performance';
import { useAbandonedCartRecovery } from './hooks/useAbandonedCartRecovery';
import { useI18n } from './lib/i18n';

import Home from './pages/Home';
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Collections = lazy(() => import('./pages/Collections'));
const CollectionDetail = lazy(() => import('./pages/CollectionDetail'));
const About = lazy(() => import('./pages/About').then(m => ({ default: m.About })));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Comparison = lazy(() => import('./pages/Comparison'));
const SizeGuide = lazy(() => import('./pages/SizeGuide'));
const GuestOrder = lazy(() => import('./pages/GuestOrder'));
const SharedWishlist = lazy(() => import('./pages/SharedWishlist'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const Newsletter = lazy(() => import('./pages/Newsletter').then(m => ({ default: m.Newsletter })));
const TrackOrder = lazy(() => import('./pages/TrackOrder'));

const Contact = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.Contact })));
const Shipping = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.Shipping })));
const Returns = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.Returns })));
const Privacy = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.Terms })));
const Faq = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.Faq })));

const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));

const Account = lazy(() => import('./pages/Account/Account'));
const AccountOrders = lazy(() => import('./pages/Account/Orders'));
const AccountOrderDetail = lazy(() => import('./pages/Account/OrderDetail'));
const AccountAddresses = lazy(() => import('./pages/Account/Addresses'));
const AccountWishlist = lazy(() => import('./pages/Account/Wishlist'));

// Lazy-loaded: the admin dashboard is a distinct, heavier bundle that only
// admins ever visit, so it shouldn't add to the storefront's initial load.
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/Admin/Products'));
const AdminProductForm = lazy(() => import('./pages/Admin/ProductForm'));
const AdminOrders = lazy(() => import('./pages/Admin/Orders'));
const AdminCustomers = lazy(() => import('./pages/Admin/Customers'));
const AdminCustomerDetail = lazy(() => import('./pages/Admin/CustomerDetail'));
const AdminContacts = lazy(() => import('./pages/Admin/Contacts'));
const AdminNewsletter = lazy(() => import('./pages/Admin/Newsletter'));
const AdminDiscounts = lazy(() => import('./pages/Admin/Discounts'));
const AdminReturns = lazy(() => import('./pages/Admin/Returns'));

function AdminFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="nv-checker w-10 h-10 animate-pulse" />
    </div>
  );
}

function StorefrontChrome({
  children,
  loading,
  setLoading,
  searchOpen,
  setSearchOpen,
}: {
  children: React.ReactNode;
  loading: boolean;
  setLoading: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}) {
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [showChatTrigger, setShowChatTrigger] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    setShowChatTrigger(getCookieConsent() !== null);
    const onConsent = () => setShowChatTrigger(getCookieConsent() !== null);
    window.addEventListener('nerve:cookie-consent', onConsent);
    window.addEventListener('storage', onConsent);
    return () => {
      window.removeEventListener('nerve:cookie-consent', onConsent);
      window.removeEventListener('storage', onConsent);
    };
  }, []);

  return (
    <>
      {loading && <Loader onDone={() => setLoading(false)} />}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[100] focus:bg-paper focus:text-navy focus:px-4 focus:py-2 focus:font-semibold"
      >
        {t('Skip to content')}
      </a>
      <ScrollToTop />
      <Header onSearch={() => setSearchOpen(true)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />
      <ProductQuickView />
      <CrispChat />
      <CookieConsent />
      <main id="main">{children}</main>
      <Footer />

      {/* Coordinated FABs — stacked so compare never sits under chat */}
      <FloatingDock>
        <ComparisonWidget />
        {showChatTrigger && !chatbotOpen && (
          <ChatbotAITrigger onClick={() => setChatbotOpen(true)} />
        )}
      </FloatingDock>
      <ChatbotAI isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />
    </>
  );
}

// Component that uses hooks requiring providers
function AppContent() {
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Initialize Sentry, analytics, and performance monitoring inside React lifecycle
  // so a crash in any of them doesn't kill the entire module graph.
  // initSentry is async (dynamic import) — fire-and-forget.
  useEffect(() => {
    // Sentry only after explicit cookie consent (same gate as analytics).
    const maybeInitSentry = () => {
      if (getCookieConsent() === 'granted') {
        initSentry().catch(() => {
          /* Sentry init failed, continue without it */
        });
      }
    };
    maybeInitSentry();
    // Analytics only after explicit cookie consent (GDPR / privacy policy)
    const maybeInitAnalytics = () => {
      if (getCookieConsent() === 'granted') {
        try {
          initAnalytics();
        } catch {
          /* Analytics init failed */
        }
      }
    };
    maybeInitAnalytics();
    const onConsent = () => {
      maybeInitSentry();
      maybeInitAnalytics();
    };
    window.addEventListener('nerve:cookie-consent', onConsent);
    try {
      initPerformanceMonitoring();
    } catch {
      /* Perf init failed */
    }
    return () => window.removeEventListener('nerve:cookie-consent', onConsent);
  }, []);

  // Track page views automatically
  usePageTracking();

  // Track abandoned carts
  useAbandonedCartRecovery();

  // Error handler for production error tracking
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Track errors with Sentry
    trackError(error, {
      component: 'App',
      errorInfo: errorInfo.componentStack,
      route: location.pathname,
    });
  };

  const routes = (
    <Suspense fallback={<SimpleSkeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:slug" element={<ProductDetail />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collections/:id" element={<CollectionDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/compare" element={<Comparison />} />
        <Route path="/size-guide" element={<SizeGuide />} />
        <Route path="/newsletter" element={<Newsletter />} />
        <Route path="/track-order" element={<TrackOrder />} />

        <Route path="/guest-order" element={<GuestOrder />} />
        <Route path="/wishlist/:shareCode" element={<SharedWishlist />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/shipping" element={<Shipping />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Suspense fallback={<SimpleSkeleton />}>
                <Account />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/orders"
          element={
            <ProtectedRoute>
              <Suspense fallback={<SimpleSkeleton />}>
                <AccountOrders />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/orders/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={<SimpleSkeleton />}>
                <AccountOrderDetail />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/addresses"
          element={
            <ProtectedRoute>
              <Suspense fallback={<SimpleSkeleton />}>
                <AccountAddresses />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/wishlist"
          element={
            <ProtectedRoute>
              <Suspense fallback={<SimpleSkeleton />}>
                <AccountWishlist />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<AdminFallback />}>
              <Routes>
                <Route
                  index
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />
                <Route
                  path="products"
                  element={
                    <AdminRoute>
                      <AdminProducts />
                    </AdminRoute>
                  }
                />
                <Route
                  path="products/:id"
                  element={
                    <AdminRoute>
                      <AdminProductForm />
                    </AdminRoute>
                  }
                />
                <Route
                  path="orders"
                  element={
                    <AdminRoute>
                      <AdminOrders />
                    </AdminRoute>
                  }
                />
                <Route
                  path="customers"
                  element={
                    <AdminRoute>
                      <AdminCustomers />
                    </AdminRoute>
                  }
                />
                <Route
                  path="customers/:id"
                  element={
                    <AdminRoute>
                      <AdminCustomerDetail />
                    </AdminRoute>
                  }
                />
                <Route
                  path="contacts"
                  element={
                    <AdminRoute>
                      <AdminContacts />
                    </AdminRoute>
                  }
                />
                <Route
                  path="newsletter"
                  element={
                    <AdminRoute>
                      <AdminNewsletter />
                    </AdminRoute>
                  }
                />
                <Route
                  path="discounts"
                  element={
                    <AdminRoute>
                      <AdminDiscounts />
                    </AdminRoute>
                  }
                />
                <Route
                  path="returns"
                  element={
                    <AdminRoute>
                      <AdminReturns />
                    </AdminRoute>
                  }
                />
                <Route
                  path="*"
                  element={
                    <AdminRoute>
                      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-5">
                        <h1 className="nv-heading text-4xl mb-3">Admin page not found</h1>
                        <p className="text-navy/60 mb-6">
                          The admin page you&apos;re looking for doesn&apos;t exist.
                        </p>
                        <Link
                          to="/admin"
                          className="inline-block bg-navy text-white nv-eyebrow px-6 py-3 hover:bg-navy-2 transition-colors"
                        >
                          Back to Admin Dashboard
                        </Link>
                      </div>
                    </AdminRoute>
                  }
                />
              </Routes>
            </Suspense>
          }
        />

        <Route path="/500" element={<ErrorFallback />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );

  return (
    <ErrorBoundary
      onError={handleError}
      // Reset the boundary on navigation so one crashed route doesn't
      // pin the fallback over every later page (BUG-03).
      resetKeys={[location.pathname, location.search]}
    >
      {isAdminRoute ? (
        routes
      ) : (
        <StorefrontChrome
          loading={loading}
          setLoading={setLoading}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
        >
          {routes}
        </StorefrontChrome>
      )}
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <CartProvider>
        <WishlistProvider>
          <BrowsingHistoryProvider>
            <QuickViewProvider>
              <ComparisonProvider>
                <AppContent />
              </ComparisonProvider>
            </QuickViewProvider>
          </BrowsingHistoryProvider>
        </WishlistProvider>
      </CartProvider>
    </ToastProvider>
  );
}
