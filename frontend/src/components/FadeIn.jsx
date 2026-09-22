import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export default function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  y = 20,
  x = 0,
  className = '',
  once = true,
}) {
  const ref = useRef(null);
  // margin: '0px' — trigger as soon as the element touches the viewport edge.
  // Negative margin ('-60px') was forcing users to scroll deep past elements
  // before animations fired, causing the "need to scroll 3-4 times" symptom.
  const inView = useInView(ref, { once, margin: '0px 0px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y, x }}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y, x }}
      transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}
