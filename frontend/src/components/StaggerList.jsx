import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const container = {
  hidden: {},
  show: (staggerDelay = 0.07) => ({
    transition: { staggerChildren: staggerDelay },
  }),
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export function StaggerList({ children, staggerDelay = 0.07, className = '', once = true }) {
  const ref = useRef(null);
  // margin: '0px' — trigger at viewport edge, not -40px inside.
  const inView = useInView(ref, { once, margin: '0px 0px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={container}
      custom={staggerDelay}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
