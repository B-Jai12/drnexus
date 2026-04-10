"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { ArrowRight, BarChart3, Brain, Shield, Sparkles, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, useMotionValue, useSpring, useTransform, useScroll } from "framer-motion"
import { StaggerContainer, StaggerItem } from "@/components/page-transition"

function TypeWriter({ words, className }: { words: string[]; className?: string }) {
  const [index, setIndex] = useState(0)
  const [text, setText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const word = words[index]
    const speed = isDeleting ? 40 : 80
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setText(word.slice(0, text.length + 1))
        if (text.length + 1 === word.length) setTimeout(() => setIsDeleting(true), 2000)
      } else {
        setText(word.slice(0, text.length - 1))
        if (text.length === 0) { setIsDeleting(false); setIndex((i) => (i + 1) % words.length) }
      }
    }, speed)
    return () => clearTimeout(timeout)
  }, [text, isDeleting, index, words])

  return (
    <span className={className}>
      {text}
      <span className="animate-pulse text-primary">|</span>
    </span>
  )
}

function AnimatedCounter({ target, prefix = "", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const steps = 50
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(current))
    }, 30)
    return () => clearInterval(timer)
  }, [target, isVisible])

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

function FloatingOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -20, 0], x: [0, 10, 0], scale: [1, 1.05, 1] }}
      transition={{ duration: 8, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useTransform(y, [-100, 100], [4, -4]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [-100, 100], [-4, 4]), { stiffness: 300, damping: 30 })

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    x.set(e.clientX - rect.left - rect.width / 2)
    y.set(e.clientY - rect.top - rect.height / 2)
  }

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 600 }}
      onMouseMove={handleMouse}
      onMouseLeave={() => { x.set(0); y.set(0) }}
      whileHover={{ scale: 1.03, y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.div>
  )
}

// Mini dashboard preview card
function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative max-w-2xl mx-auto mt-12"
    >
      {/* Glow behind card */}
      <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-3xl scale-95" />

      <div className="relative rounded-2xl border border-border/50 bg-background/80 backdrop-blur-xl overflow-hidden shadow-2xl">
        {/* Fake browser bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
          </div>
          <div className="flex-1 mx-4 h-5 rounded-md bg-muted/40 flex items-center px-2">
            <span className="text-[10px] text-muted-foreground">localhost:3000/dashboard/overview</span>
          </div>
        </div>

        {/* Mini dashboard content */}
        <div className="p-4 space-y-3">
          {/* Mini stat cards */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Health Score", value: "78/100", color: "text-emerald-400" },
              { label: "Total Debit", value: "₹46,410", color: "text-red-400" },
              { label: "Total Credit", value: "₹52,000", color: "text-blue-400" },
              { label: "Net Savings", value: "₹5,590", color: "text-purple-400" },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.08 }}
                className="rounded-lg bg-muted/20 border border-border/30 p-2"
              >
                <p className="text-[9px] text-muted-foreground">{card.label}</p>
                <p className={`text-xs font-bold mt-0.5 ${card.color}`}>{card.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Mini bar chart */}
          <div className="rounded-lg bg-muted/10 border border-border/20 p-3">
            <p className="text-[9px] text-muted-foreground mb-2">Monthly Overview</p>
            <div className="flex items-end gap-1 h-12">
              {[40, 65, 45, 80, 55, 70].map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/40"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 1 + i * 0.08, duration: 0.4 }}
                />
              ))}
              {[30, 55, 35, 70, 45, 60].map((h, i) => (
                <motion.div
                  key={`c${i}`}
                  className="flex-1 rounded-sm bg-emerald-400/40"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 1.1 + i * 0.08, duration: 0.4 }}
                />
              ))}
            </div>
          </div>

          {/* Mini transaction rows */}
          <div className="space-y-1.5">
            {[
              { name: "Zomato", cat: "Food & Dining", amount: "-₹213", color: "text-red-400" },
              { name: "Spotify", cat: "Subscriptions", amount: "-₹119", color: "text-red-400" },
              { name: "Salary Credit", cat: "Income", amount: "+₹52,000", color: "text-emerald-400" },
            ].map((txn, i) => (
              <motion.div
                key={txn.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + i * 0.08 }}
                className="flex items-center justify-between rounded-lg bg-muted/10 border border-border/20 px-3 py-1.5"
              >
                <div>
                  <p className="text-[10px] font-medium text-foreground">{txn.name}</p>
                  <p className="text-[8px] text-muted-foreground">{txn.cat}</p>
                </div>
                <p className={`text-[10px] font-bold ${txn.color}`}>{txn.amount}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function HeroSection() {
  const { scrollYProgress } = useScroll()
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])
  const orbScale = useTransform(scrollYProgress, [0, 0.3], [1, 1.2])

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pb-24 pt-24">
      {/* Background */}
      <motion.div className="absolute inset-0 bg-background" style={{ scale: orbScale }}>
        <div className="absolute inset-0 opacity-30">
          <FloatingOrb className="absolute top-[15%] left-[20%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]" delay={0} />
          <FloatingOrb className="absolute bottom-[20%] right-[15%] w-[400px] h-[400px] bg-chart-2/20 rounded-full blur-[100px]" delay={2} />
          <FloatingOrb className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" delay={4} />
          <FloatingOrb className="absolute top-[10%] right-[30%] w-[200px] h-[200px] bg-chart-4/15 rounded-full blur-[80px]" delay={3} />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,hsl(var(--background))_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </motion.div>

      <motion.div
        className="relative z-10 max-w-6xl mx-auto px-6 text-center"
        style={{ y: heroY, opacity: heroOpacity }}
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm mb-8"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI-Powered Financial Intelligence</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 text-balance"
        >
          <TypeWriter
            words={["Master Your Money", "Track Every Rupee", "Save Smarter Today"]}
            className="gradient-text"
          />
          <br />
          <span className="text-foreground">with </span>
          <span className="gradient-text">Dr.Nexus</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty leading-relaxed"
        >
          Upload your bank statements and let our ML engine analyze your spending patterns,
          predict future expenses, and deliver personalized recommendations to grow your savings.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
        >
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Button asChild size="lg" className="text-base px-8 h-12 rounded-xl glow-sm hover:glow-md transition-shadow duration-300 group">
              <Link href="/dashboard/upload">
                Upload Statement
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Button asChild variant="outline" size="lg" className="text-base px-8 h-12 rounded-xl bg-transparent hover:bg-primary/5 transition-colors gap-2">
              <Link href="/dashboard/overview">
                <Play className="w-4 h-4" />
                View Demo Dashboard
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs text-muted-foreground mb-4"
        >
          🔒 Your data never leaves your device · No account required · 100% free
        </motion.p>

        {/* Mini Dashboard Preview */}
        <DashboardPreview />

        {/* Stats — below the preview */}
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto mt-12" delay={0.3}>
          {[
            { icon: BarChart3, label: "Transactions Analyzed", value: 50000, suffix: "+" },
            { icon: Shield, label: "Accuracy Rate", value: 96, suffix: "%" },
            { icon: Brain, label: "AI Recommendations", value: 12000, suffix: "+" },
          ].map((stat) => (
            <StaggerItem key={stat.label}>
              <TiltCard>
                <div className="glass-hover rounded-2xl p-6 text-center gradient-border hover-lift">
                  <stat.icon className="w-6 h-6 text-primary mx-auto mb-3" />
                  <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              </TiltCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </motion.div>
    </section>
  )
}