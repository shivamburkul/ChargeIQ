
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import BoltMark from '../components/BoltMark';
import HeroIllustration from '../components/HeroIllustration';
import FadeIn from '../components/FadeIn';
import { StaggerList, StaggerItem } from '../components/StaggerList';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: '🧭', title: 'Smart recommendations', desc: 'Every suggestion is scored on distance, price, speed, availability and rating — with a plain-English reason attached, so you always know why.' },
  { icon: '🔍', title: 'Describe what you need', desc: 'Search in your own words — "fast charger under ₹12 with a cafe nearby" — and get matching stations instantly.' },
  { icon: '🔋', title: 'Charging planner', desc: 'Enter your battery level and target charge — get a real time & cost estimate before you book, no surprises.' },
  { icon: '🗺️', title: 'Live satellite map & directions', desc: 'Browse real stations on a live satellite map, get turn-by-turn directions, and track your route as you drive.' },
  { icon: '🧾', title: 'Automatic invoicing', desc: 'Every completed session generates a downloadable, itemised invoice — no manual bookkeeping.' },
  { icon: '📊', title: 'Built for every role', desc: 'Drivers, station owners and network admins each get tools and analytics tuned to what they actually need.' },
];

const STEPS = [
  { n: '01', title: 'Add your vehicle', desc: 'Pick your EV from our model catalog and your specs auto-fill — battery size, range, connector type, charging speed.' },
  { n: '02', title: 'Find the right station', desc: 'Search by location, price, connector or plain description, or let smart recommendations do the work.' },
  { n: '03', title: 'Book & get directions', desc: 'Reserve your slot, see the live route to the station, and track your charging session in real time.' },
  { n: '04', title: 'Pay & go', desc: 'Your invoice generates automatically the moment charging completes — download it anytime.' },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="relative">
      {/* ─── HERO ───────────────────────────────────────────────────────────
          min-h fills the viewport below the navbar (4rem = 64px) so "How
          ChargeIQ works" and everything below stays off-screen until the
          user actually scrolls, exactly like before — just with the text
          and illustration sized down a medium amount so the hero's own
          content doesn't overflow past that viewport height.
      ──────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 md:pt-8 pb-16 md:pb-20 w-full">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-14 items-center">

            {/* Left — text */}
            <div>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="inline-flex items-center gap-2 badge bg-white/30 backdrop-blur-sm text-slate-800 dark:bg-brand-900/40 dark:text-brand-300 border border-white/40 mb-5"
              >
                <BoltMark className="w-5 h-5" animated /> India's smart EV charging network
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12 }}
                className="font-display text-4xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]"
              >
                Power your drive,<br />
                <span className="text-brand-600">charge the future.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.22 }}
                className="mt-5 text-base lg:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed"
              >
                Find, book and pay for EV charging stations seamlessly — with live directions,
                real-time slot availability and transparent pricing across the country.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.32 }}
                className="mt-7 flex flex-wrap gap-3"
              >
                {user ? (
                  <Link to="/search" className="btn-primary text-sm px-6 py-3">Find a station →</Link>
                ) : (
                  <>
                    <Link to="/register" className="btn-primary text-sm px-6 py-3">Get started free</Link>
                    <Link to="/search" className="btn-secondary text-sm px-6 py-3">Explore the map</Link>
                  </>
                )}
              </motion.div>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.48 }}
                className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-2 text-sm text-slate-600 dark:text-slate-400"
              >
                <div className="flex flex-col">
                  <span className="font-display text-xl font-bold text-slate-800 dark:text-white">2000+</span>
                  <span>charging points</span>
                </div>
                <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                <div className="flex flex-col">
                  <span className="font-display text-xl font-bold text-slate-800 dark:text-white">998</span>
                  <span>cities covered</span>
                </div>
                <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                <div className="flex flex-col">
                  <span className="font-display text-xl font-bold text-slate-800 dark:text-white">24</span>
                  <span>EV models supported</span>
                </div>
              </motion.div>
            </div>

            {/* Right — illustration. No max-width cap: it fills its grid
                column just like the text column fills its own, so both
                sides read as the same visual size instead of the
                illustration looking small and adrift in extra space. */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative w-full"
            >
              <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/10 bg-white/5 dark:bg-transparent">
                {/*
                  w-full + no fixed height: SVG viewBox="0 0 800 560" means
                  aspect-ratio is ~1.43. With no max-width on any ancestor,
                  this fills the full grid column width (same as the text
                  column), so it carries equal visual weight.
                */}
                <HeroIllustration className="w-full h-auto" />
              </div>

              {/* Floating stat badge — adds visual weight to the right side */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                className="absolute -top-3 -right-3 hidden lg:flex items-center gap-2 card px-3.5 py-2 shadow-lg"
              >
                <span className="text-xl">⚡</span>
                <div>
                  <p className="text-[11px] text-slate-500">Avg. charge time</p>
                  <p className="font-display font-bold text-xs">28 min</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="absolute -bottom-3 -left-3 hidden lg:flex items-center gap-2 card px-3.5 py-2 shadow-lg"
              >
                <span className="text-xl">🔋</span>
                <div>
                  <p className="text-[11px] text-slate-500">Sessions today</p>
                  <p className="font-display font-bold text-xs">1,247</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ──────────────────────────────────────────────────
          Only visible after scrolling — no FadeIn needed on the section
          shell since the section itself is below the fold.
      ──────────────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <FadeIn className="text-center mb-10" y={16}>
          <h2 className="font-display text-2xl md:text-3xl font-bold">How ChargeIQ works</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2">From adding your car to paying for your last kilowatt-hour — four simple steps.</p>
        </FadeIn>
        <StaggerList className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" staggerDelay={0.09}>
          {STEPS.map((s) => (
            <StaggerItem key={s.n}>
              <motion.div
                whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(5,150,105,0.12)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="card p-5 relative overflow-hidden h-full"
              >
                <span className="font-display text-4xl font-bold text-brand-100 dark:text-brand-900/60 absolute top-3 right-4">{s.n}</span>
                <h3 className="font-semibold mb-1.5 relative">{s.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 relative">{s.desc}</p>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerList>
      </section>

      {/* ─── FEATURES ──────────────────────────────────────────────────── */}
      <section className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-md dark:backdrop-blur-none border-y border-slate-200/70 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <FadeIn className="text-center mb-10" y={16}>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">Everything you need to charge with confidence</h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-2xl mx-auto">Not just a station locator — a complete charging companion.</p>
          </FadeIn>
          <StaggerList className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" staggerDelay={0.075}>
            {FEATURES.map((f) => (
              <StaggerItem key={f.title}>
                <motion.div
                  whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(5,150,105,0.12)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="card p-5 h-full"
                >
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{f.desc}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <FadeIn y={16}>
          <h2 className="font-display text-3xl font-bold mb-3">Ready to charge smarter?</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-xl mx-auto">
            Join as a driver to start booking, or list your own charging point and start earning.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {!user && <Link to="/register" className="btn-primary text-base px-6 py-3">Create free account</Link>}
            <Link to="/search" className="btn-secondary text-base px-6 py-3">Browse the map</Link>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
