"use client"

import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
import { usePathname } from "next/navigation"
import React from "react"

// --- Quick, subtle page transition (opacity only, no slide) ---
export function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    )
}

// --- Scroll-triggered reveal (subtle, fast) ---
export function Reveal({
    children,
    className,
    delay = 0,
    direction = "up",
    width = "100%",
}: {
    children: React.ReactNode
    className?: string
    delay?: number
    direction?: "up" | "down" | "left" | "right" | "none"
    width?: string
}) {
    const y = direction === "up" ? 16 : direction === "down" ? -16 : 0
    const x = direction === "left" ? 16 : direction === "right" ? -16 : 0

    return (
        <motion.div
            className={className}
            style={{ width }}
            initial={{ opacity: 0, y, x }}
            whileInView={{ opacity: 1, y: 0, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
                duration: 0.5,
                delay,
                ease: [0.21, 0.47, 0.32, 0.98],
            }}
        >
            {children}
        </motion.div>
    )
}

// --- Stagger container (fast stagger, no PPT feel) ---
export function StaggerContainer({
    children,
    className,
    staggerDelay = 0.06,
    delay = 0,
}: {
    children: React.ReactNode
    className?: string
    staggerDelay?: number
    delay?: number
}) {
    return (
        <motion.div
            className={className}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={{
                hidden: {},
                visible: {
                    transition: {
                        staggerChildren: staggerDelay,
                        delayChildren: delay,
                    },
                },
            }}
        >
            {children}
        </motion.div>
    )
}

// --- Stagger child item ---
export function StaggerItem({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <motion.div
            className={className}
            variants={{
                hidden: { opacity: 0, y: 12 },
                visible: {
                    opacity: 1,
                    y: 0,
                    transition: {
                        duration: 0.4,
                        ease: [0.21, 0.47, 0.32, 0.98],
                    },
                },
            }}
        >
            {children}
        </motion.div>
    )
}

// --- FadeInView (legacy compat, uses Reveal internally) ---
export function FadeInView({
    children,
    className,
    delay = 0,
}: {
    children: React.ReactNode
    className?: string
    delay?: number
}) {
    return (
        <Reveal className={className} delay={delay}>
            {children}
        </Reveal>
    )
}

// --- Hover lift for cards ---
export function HoverScale({
    children,
    className,
    scale = 1.02,
}: {
    children: React.ReactNode
    className?: string
    scale?: number
}) {
    return (
        <motion.div
            className={className}
            whileHover={{ scale, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
            {children}
        </motion.div>
    )
}

// --- Scroll Progress Bar ---
export function ScrollProgressBar() {
    const { scrollYProgress } = useScroll()

    return (
        <motion.div
            className="fixed top-0 left-0 right-0 h-[2px] bg-primary z-[100] origin-left"
            style={{ scaleX: scrollYProgress }}
        />
    )
}

// --- Section Divider ---
export function AnimatedDivider({ className }: { className?: string }) {
    return (
        <motion.div
            className={`w-full flex justify-center ${className || ""}`}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
        >
            <div className="h-px w-full max-w-xl bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </motion.div>
    )
}
