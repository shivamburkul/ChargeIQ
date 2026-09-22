
import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AnimatedPage from './components/AnimatedPage';
import { useTheme } from './context/ThemeContext';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Search from './pages/Search';
import StationDetails from './pages/StationDetails';
import Compare from './pages/Compare';
import Garage from './pages/Garage';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import UserDashboard from './pages/UserDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';

// Scroll to top on every route change so the new page always starts at the top.
// Without this, navigating from a scrolled page leaves the viewport mid-page.
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  const { theme } = useTheme();
  const location = useLocation();
  const bookingOpen = location.pathname.startsWith('/stations/') && new URLSearchParams(location.search).get('book') === '1';

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col relative isolate bg-transparent">
      {/* Fixed background image with a smooth crossfade on theme change.
          Both images stay mounted and swap via opacity, instead of a hard
          class swap, so switching theme feels like a deliberate transition. */}
      <div className="page-background-layer fixed inset-0 z-0 overflow-hidden bg-surface-light dark:bg-surface-dark">
        <div
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat bg-light-bg transition-opacity duration-700 ease-in-out ${
            theme === 'dark' ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ filter: 'blur(20px)', transform: 'scale(1.1)' }}
        />
        <div
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat bg-dark-bg transition-opacity duration-700 ease-in-out ${
            theme === 'dark' ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ filter: 'blur(20px)', transform: 'scale(1.1)' }}
        />
      </div>

      <ScrollReset />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
      <Navbar />

      <div className="flex-1 min-w-0 relative">
        <Routes location={location} key={location.pathname}>
            <Route path="/" element={<AnimatedPage><Landing /></AnimatedPage>} />
            <Route path="/login" element={<AnimatedPage><Login /></AnimatedPage>} />
            <Route path="/register" element={<AnimatedPage><Register /></AnimatedPage>} />
            <Route path="/search" element={<AnimatedPage><Search /></AnimatedPage>} />
            <Route path="/stations/:id" element={<AnimatedPage><StationDetails /></AnimatedPage>} />
            <Route path="/compare" element={<AnimatedPage><Compare /></AnimatedPage>} />

            <Route path="/dashboard" element={<ProtectedRoute roles={['user']}><AnimatedPage><UserDashboard /></AnimatedPage></ProtectedRoute>} />
            <Route path="/garage" element={<ProtectedRoute roles={['user']}><AnimatedPage><Garage /></AnimatedPage></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute roles={['user']}><AnimatedPage><Bookings /></AnimatedPage></ProtectedRoute>} />
            <Route path="/bookings/:id" element={<ProtectedRoute roles={['user']}><AnimatedPage><BookingDetail /></AnimatedPage></ProtectedRoute>} />

            <Route path="/owner" element={<ProtectedRoute roles={['owner', 'admin']}><AnimatedPage><OwnerDashboard /></AnimatedPage></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AnimatedPage><AdminDashboard /></AnimatedPage></ProtectedRoute>} />

            <Route path="/profile" element={<ProtectedRoute><AnimatedPage><Profile /></AnimatedPage></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><AnimatedPage><Notifications /></AnimatedPage></ProtectedRoute>} />

            <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
        </Routes>
      </div>
      </div>
    </div>
  );
}
