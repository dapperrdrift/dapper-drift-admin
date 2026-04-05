import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/providers/AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";
import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./components/AdminLayout";
import NotFound from "./pages/NotFound";

const DashboardHome = lazy(() => import("./pages/admin/DashboardHome"));
const ProductManagement = lazy(() => import("./pages/admin/ProductManagement"));
const InventoryManagement = lazy(() => import("./pages/admin/InventoryManagement"));
const OrderManagement = lazy(() => import("./pages/admin/OrderManagement"));
const CouponManagement = lazy(() => import("./pages/admin/CouponManagement"));
const HeroCarouselManager = lazy(() => import("./pages/admin/HeroCarouselManager"));
const TestimonialsManager = lazy(() => import("./pages/admin/TestimonialsManager"));
const NewsletterManager = lazy(() => import("./pages/admin/NewsletterManager"));

const queryClient = new QueryClient();

function LazyFallback() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
      <Skeleton className="h-64 w-full mt-4" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Suspense fallback={<LazyFallback />}><DashboardHome /></Suspense>} />
              <Route path="products" element={<Suspense fallback={<LazyFallback />}><ProductManagement /></Suspense>} />
              <Route path="inventory" element={<Suspense fallback={<LazyFallback />}><InventoryManagement /></Suspense>} />
              <Route path="orders" element={<Suspense fallback={<LazyFallback />}><OrderManagement /></Suspense>} />
              <Route path="coupons" element={<Suspense fallback={<LazyFallback />}><CouponManagement /></Suspense>} />
              <Route path="hero" element={<Suspense fallback={<LazyFallback />}><HeroCarouselManager /></Suspense>} />
              <Route path="testimonials" element={<Suspense fallback={<LazyFallback />}><TestimonialsManager /></Suspense>} />
              <Route path="newsletter" element={<Suspense fallback={<LazyFallback />}><NewsletterManager /></Suspense>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
