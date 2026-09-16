"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Brain, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSection, setActiveSection] = useState("")

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Track active section via Intersection Observer
  useEffect(() => {
    const sections = ["features", "how-it-works", "testimonials", "faq"]
    const observers: IntersectionObserver[] = []

    sections.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id)
        },
        { rootMargin: "-40% 0px -40% 0px" }
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  const navLinks = [
    { label: "Features", href: "/#features", section: "features" },
    { label: "How It Works", href: "/#how-it-works", section: "how-it-works" },
    { label: "Testimonials", href: "/#testimonials", section: "testimonials" },
    { label: "FAQ", href: "/#faq", section: "faq" },
  ]

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-sm"
            : "bg-transparent"
        )}
      >
        <div className={cn(
          "max-w-6xl mx-auto flex items-center justify-between px-6 transition-all duration-300",
          scrolled ? "h-14" : "h-16"
        )}>
          <Link href="/" className="flex items-center gap-2 group">
            <motion.div
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:glow-sm transition-shadow"
              whileHover={{ rotate: 10, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <Brain className="w-5 h-5 text-primary-foreground" />
            </motion.div>
            <span className="font-bold text-foreground text-lg">Dr.Nexus</span>
          </Link>

          {/* Desktop nav with active highlight */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "text-sm transition-colors relative group",
                  activeSection === item.section
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
                {/* Animated underline */}
                <motion.span
                  className="absolute -bottom-1 left-0 h-0.5 bg-primary rounded-full"
                  initial={false}
                  animate={{
                    width: activeSection === item.section ? "100%" : "0%",
                  }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                />
                {/* Hover underline (only when not active) */}
                {activeSection !== item.section && (
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary/50 transition-all group-hover:w-full rounded-full" />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button asChild variant="ghost" size="sm" className="bg-transparent hidden sm:inline-flex">
                <Link href="/dashboard/overview">Dashboard</Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard/upload">Upload Statement</Link>
              </Button>
            </motion.div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden bg-transparent"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-14 z-40 bg-background/95 backdrop-blur-xl border-b border-border md:hidden"
          >
            <nav className="flex flex-col p-4 space-y-1">
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "text-sm transition-colors px-4 py-3 rounded-xl",
                    activeSection === item.section
                      ? "text-foreground bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex gap-2 pt-2 px-4">
                <Button asChild variant="outline" size="sm" className="flex-1 bg-transparent">
                  <Link href="/dashboard/overview">Dashboard</Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href="/dashboard/upload">Upload</Link>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
