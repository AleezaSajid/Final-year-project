import { motion, useReducedMotion } from "framer-motion";

const easeOut = [0.2, 0.8, 0.2, 1];

export default function PageTransition({ children }) {
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <motion.div
      className="contents"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

