import { Suspense, lazy, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Loader from './components/Loader';
import SimpleSkeleton from './components/SimpleSkeleton';
import CartDrawer from './components/CartDrawer';
import SearchOverlay from './components/SearchOverlay';
import ChatbotAI, { ChatbotAITrigger } from './components/ChatbotAI';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ToastProvider } from './context/ToastContext';
import { initSentry, trackError } from './lib/sentry';
import { initAnalytics, usePageTracking } from './lib/analytics';
import { initPerformanceMonitoring } from './lib/performance';

// Initialize Sentry error tracking and analytics
initSentry();
initAnalytics();
initPerformanceMonitoring();

import Home from './pages/Home';
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import { About } from './pages/About';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import GuestOrder from './pages/GuestOrder';
import NotFound from './pages/NotFound';
import { Contact, Shipping, Returns, Privacy, Terms } from './pages/InfoPages';
import Unsubscribe from './pages/Unsubscribe';
import { Newsletter } from './pages/Newsletter';
import { TrackOrder } from './pages/TrackOrder';

import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';

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

  return (
    <>
      {loading && <Loader onDone={() => setLoading(false)} />}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-paper focus:text-navy focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>
      <ScrollToTop />
      <Header onSearch={() => setSearchOpen(true)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />
      <main id="main">{children}</main>
      <Footer />

      {/* Chatbot */}
      <ChatbotAI isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />
      {!chatbotOpen && <ChatbotAITrigger onClick={() => setChatbotOpen(true)} />}
    </>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Track page views automatically
  usePageTracking();

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
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/shop"
        element={
          <Suspense fallback={<SimpleSkeleton />}>
            <Shop />
          </Suspense>
        }
      />
      <Route
        path="/product/:slug"
        element={
          <Suspense fallback={<SimpleSkeleton />}>
            <ProductDetail />
          </Suspense>
        }
      />
      <Route path="/collections" element={<Collections />} />
      <Route path="/collections/:id" element={<CollectionDetail />} />
      <Route path="/about" element={<About />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/newsletter" element={<Newsletter />} />
      <Route path="/track-order" element={<TrackOrder />} />

      <Route path="/guest-order" element={<GuestOrder />} />
      <Route path="/contact" element={<Contact />} />
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
            </Routes>
          </Suspense>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );

  return (
    <ErrorBoundary onError={handleError}>
      <CartProvider>
        <WishlistProvider>
          <ToastProvider>
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
          </ToastProvider>
        </WishlistProvider>
      </CartProvider>
    </ErrorBoundary>
  );
}
