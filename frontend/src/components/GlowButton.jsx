import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';

export default function GlowButton({ children, onClick, href, className = '' }) {
  const [ripples, setRipples] = useState([]);

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
    if (onClick) onClick(e);
  };

  const Tag = href ? 'a' : 'button';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="inline-flex"
    >
      <Tag
        href={href}
        onClick={handleClick}
        className={`relative overflow-hidden group cursor-pointer select-none inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold rounded-2xl text-white bg-gradient-to-r from-eco-500 to-emerald-600 shadow-lg shadow-eco-500/25 hover:shadow-eco-500/40 hover:shadow-xl transition-shadow duration-300 ${className}`}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl"
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(34, 197, 94, 0)',
              '0 0 20px 4px rgba(34, 197, 94, 0.3)',
              '0 0 0 0 rgba(34, 197, 94, 0)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="relative z-10 flex items-center gap-2">
          {children}
          <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
        </span>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="absolute pointer-events-none rounded-full bg-white/30"
            initial={{ x: r.x - 10, y: r.y - 10, width: 20, height: 20, opacity: 0.6 }}
            animate={{ x: r.x - 100, y: r.y - 100, width: 200, height: 200, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        ))}
      </Tag>
    </motion.div>
  );
}
