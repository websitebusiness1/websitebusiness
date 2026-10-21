import { lazy, Suspense, useEffect } from 'react';
import { Link, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { RequireMember, RequireOwner } from '@/auth/guards';
import { PageLoader } from '@/components/ui';
import OwnerLayout from '@/layouts/OwnerLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import Home from '@/pages/Home';
import Login from '@/pages/Login';





import StoreFrame from '@/components/store/StoreFrame';
import Storefront from '@/pages/store/Storefront';
import ProductPage from '@/pages/store/ProductPage';
import CartPage from '@/pages/store/CartPage';
import CheckoutPage from '@/pages/store/CheckoutPage';
import OrderConfirmation from '@/pages/store/OrderConfirmation';





const OwnerOverview = lazy(() => import('@/pages/owner/OwnerOverview'));
const OwnerStores = lazy(() => import('@/pages/owner/OwnerStores'));
const OwnerStoreNew = lazy(() => import('@/pages/owner/OwnerStoreNew'));
const OwnerStoreDetail = lazy(() => import('@/pages/owner/OwnerStoreDetail'));
const OwnerMembers = lazy(() => import('@/pages/owner/OwnerMembers'));
const DashboardOverview = lazy(() => import('@/pages/dashboard/DashboardOverview'));
const Products = lazy(() => import('@/pages/dashboard/Products'));
const ProductEditor = lazy(() => import('@/pages/dashboard/ProductEditor'));
const Inventory = lazy(() => import('@/pages/dashboard/Inventory'));
const Orders = lazy(() => import('@/pages/dashboard/Orders'));
const OrderDetail = lazy(() => import('@/pages/dashboard/OrderDetail'));
const StoreSettings = lazy(() => import('@/pages/dashboard/StoreSettings'));

function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-4xl">Page not found</h1>
      <p className="mt-3 text-sm text-sand-500">That address doesn’t lead anywhere.</p>
      <Link to="/" className="btn-outline mt-6 self-start">Back to home</Link>
    </div>
  );
}

function StoreRoute() {
  const { slug } = useParams();
  return <StoreFrame slug={slug}><Outlet /></StoreFrame>;
}

function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToHash />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Public storefront, cart and checkout */}
        <Route path="/store/:slug" element={<StoreRoute />}>
          <Route index element={<Storefront />} />
          <Route path="product/:productSlug" element={<ProductPage />} />
        </Route>
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-confirmation/:orderReference" element={<OrderConfirmation />} />

        <Route path="/owner" element={<RequireOwner><OwnerLayout /></RequireOwner>}>
          <Route index element={<OwnerOverview />} />
          <Route path="stores" element={<OwnerStores />} />
          <Route path="stores/new" element={<OwnerStoreNew />} />
          <Route path="stores/:id" element={<OwnerStoreDetail />} />
          <Route path="members" element={<OwnerMembers />} />
        </Route>

        <Route path="/dashboard" element={<RequireMember><DashboardLayout /></RequireMember>}>
          <Route index element={<DashboardOverview />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductEditor mode="new" />} />
          <Route path="products/:id" element={<ProductEditor mode="edit" />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="store-settings" element={<StoreSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  );
}
