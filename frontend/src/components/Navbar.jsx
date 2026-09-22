
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BoltMark from './BoltMark';
import { notificationApi } from '../api/endpoints';

const linkClass = ({ isActive }) =>
  `block md:inline-flex whitespace-nowrap px-2.5 lg:px-3 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-600/10 text-brand-700 dark:text-brand-400'
      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/40 dark:hover:bg-slate-800'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    notificationApi.list()
      .then((res) => setUnread(res.data.notifications.filter((n) => !n.isRead).length))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    function closeMenus(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', closeMenus);
    return () => document.removeEventListener('mousedown', closeMenus);
  }, []);

  // Belt-and-braces: also close both menus whenever the route changes, so
  // navigating (including via the browser back/forward buttons) never
  // leaves a stale dropdown open on screen.
  useEffect(() => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const roleLinks = {
    user: [
      { to: '/search', label: 'Find Stations' },
      { to: '/garage', label: 'My Garage' },
      { to: '/bookings', label: 'Bookings' },
      { to: '/dashboard', label: 'Dashboard' },
    ],
    owner: [
      { to: '/owner', label: 'Owner Dashboard' },
      { to: '/search', label: 'Explore Map' },
    ],
    admin: [
      { to: '/admin', label: 'Admin Console' },
      { to: '/search', label: 'Explore Map' },
    ],
  };

  const links = user ? roleLinks[user.role] || [] : [];

  return (
    <header ref={menuRef} className={`navbar-shell sticky top-3 z-[900] w-[calc(100%-1.5rem)] sm:w-[calc(100%-3rem)] max-w-7xl mx-auto overflow-visible ${mobileMenuOpen ? 'navbar-shell-open' : ''} bg-white/75 dark:bg-surface-dark/75 backdrop-blur-2xl border border-white/40 dark:border-slate-800/80 shadow-lg shadow-slate-900/10 dark:shadow-black/20`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        <Link to="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
          <BoltMark className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
          <span className="font-display font-bold text-base sm:text-lg tracking-tight truncate">ChargeIQ</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          {links.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { setMobileMenuOpen((o) => !o); setMenuOpen(false); }}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              className="md:hidden w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100/40 dark:hover:bg-slate-800 transition-colors text-xl"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mobileMenuOpen ? 'close' : 'open'}
                  initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
                  transition={{ duration: 0.18 }}
                >
                  {mobileMenuOpen ? '×' : '☰'}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.88, rotate: 20 }}
            transition={{ duration: 0.18 }}
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100/40 dark:hover:bg-slate-800 transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ opacity: 0, scale: 0.5, rotate: -30 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5, rotate: 30 }}
                transition={{ duration: 0.22 }}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </motion.span>
            </AnimatePresence>
          </motion.button>

          {user && (
            <Link to="/notifications" className="relative w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100/40 dark:hover:bg-slate-800 transition-colors">
              🔔
              <AnimatePresence>
                {unread > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"
                  />
                )}
              </AnimatePresence>
            </Link>
          )}

          {user ? (
            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setMenuOpen((o) => !o); setMobileMenuOpen(false); }}
                className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 pr-1.5 sm:pr-3 py-1.5 rounded-lg hover:bg-slate-100/40 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm font-medium">{user.name?.split(' ')[0]}</span>
              </motion.button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    key="dropdown"
                    initial={false}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="profile-menu absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl shadow-lg p-1.5 z-[910] origin-top-right"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    <div className="px-3 py-2 text-xs text-slate-500 uppercase tracking-wide">{user.role} account</div>
                    <Link to="/profile" className="block px-3 py-2 rounded-lg text-sm hover:bg-slate-100/40 dark:hover:bg-slate-800" onClick={() => setMenuOpen(false)}>Profile</Link>
                    <button
                      onClick={() => { logout(); setMenuOpen(false); navigate('/'); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50/40 dark:hover:bg-red-950/40"
                    >
                      Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary !px-3 !py-2 text-sm">Log in</Link>
              <Link to="/register" className="btn-primary !px-3 !py-2 text-sm">Sign up</Link>
            </div>
          )}
        </div>
      </div>
      <nav className={`navbar-mobile-menu md:hidden ${mobileMenuOpen ? 'navbar-mobile-menu-open' : ''}`}>
        <div className="navbar-mobile-menu-inner border-t border-white/30 dark:border-slate-800/70 rounded-b-3xl px-3 py-2">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass} onClick={() => setMobileMenuOpen(false)}>
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
