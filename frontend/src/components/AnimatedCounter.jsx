import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useSpring, useMotionValueEvent } from 'framer-motion';

export default function AnimatedCounter({ value = 0, suffix = '', decimals = 0, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 50, damping: 20 });
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    if (inView) {
      motionValue.set(value);
    }
  }, [inView, value, motionValue]);

  useMotionValueEvent(spring, "change", (latest) => {
    setDisplayValue(latest.toFixed(decimals));
  });

  return (
    <motion.span ref={ref} className={className}>
      {displayValue}{suffix}
    </motion.span>
  );
}
