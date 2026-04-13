"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function Stagger({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function FadeItem({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.38, ease },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function LiftHover({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -3, transition: { duration: 0.22, ease } }}
      whileTap={{ scale: 0.99 }}
    >
      {children}
    </motion.div>
  );
}
