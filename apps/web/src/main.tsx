import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { AuthProvider } from './lib/auth';
import { ApiError } from './lib/api';
import { AppLayout, PublicLayout, RequireAuth, Root } from './components/Layout';
import { PageLoader } from './components/ui';
import Home from './pages/Home';
import RouteError from './pages/RouteError';

// Route-level code splitting: maps and dashboards load only when visited.
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() =>
  import('./pages/Auth').then((m) => ({ default: m.ForgotPassword })),
);
const ResetPassword = lazy(() =>
  import('./pages/Auth').then((m) => ({ default: m.ResetPassword })),
);
const Search = lazy(() => import('./pages/Search'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TechnicianPage = lazy(() => import('./pages/TechnicianPage'));
const Bookings = lazy(() => import('./pages/Bookings'));
const BookingDetail = lazy(() => import('./pages/BookingDetail'));
const MockPay = lazy(() => import('./pages/MockPay'));
const WorkProfile = lazy(() => import('./pages/WorkProfile'));
const Admin = lazy(() => import('./pages/Admin'));
const Account = lazy(() => import('./pages/Account'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

const s = (el: React.ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      {
        // Public website
        element: <PublicLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/login', element: s(<Login />) },
          { path: '/register', element: s(<Register />) },
          { path: '/forgot-password', element: s(<ForgotPassword />) },
          { path: '/reset-password', element: s(<ResetPassword />) },
          { path: '/search', element: s(<Search />) },
          { path: '/technicians/:id', element: s(<TechnicianPage />) },
          { path: '*', element: s(<NotFound />) },
        ],
      },
      {
        // Logged-in app (sidebar shell)
        element: <AppLayout />,
        children: [
          {
            path: '/dashboard',
            element: (
              <RequireAuth roles={['customer', 'technician']}>{s(<Dashboard />)}</RequireAuth>
            ),
          },
          {
            path: '/bookings',
            element: (
              <RequireAuth roles={['customer', 'technician']}>{s(<Bookings />)}</RequireAuth>
            ),
          },
          { path: '/bookings/:id', element: s(<BookingDetail />) },
          {
            path: '/technician/profile',
            element: <RequireAuth roles={['technician']}>{s(<WorkProfile />)}</RequireAuth>,
          },
          { path: '/admin', element: <RequireAuth roles={['admin']}>{s(<Admin />)}</RequireAuth> },
          { path: '/account', element: s(<Account />) },
        ],
      },
      // Payment gateway checkout: a standalone page, like a real gateway's hosted page.
      {
        path: '/mockpay/:ref',
        element: <RequireAuth roles={['customer']}>{s(<MockPay />)}</RequireAuth>,
      },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
