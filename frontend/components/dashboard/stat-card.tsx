"use client"

import { ReactNode, useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  prefix?: string
  suffix?: string
  icon: LucideIcon
  change?: number
  changePeriod?: string
  gradient?: string
  delay?: number
}

function AnimatedValue({ target, prefix = "", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

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

  return (
    <div ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </div>
  )
}

export function StatCard({
  title,
  value,
  prefix = "",
  suffix = "",
  icon: Icon,
  change,
  changePeriod = "vs last month",
  gradient = "from-primary/10 to-primary/5",
  delay = 0,
}: StatCardProps) {
  const isPositive = change !== undefined && change >= 0
  const numValue = typeof value === "string" ? parseFloat(value.replace(/[^0-9.]/g, "")) : value

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.4, 0.25, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="glass-hover rounded-2xl p-6 gradient-border group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center", gradient)}>
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {change !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
              isPositive
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-red-500/10 text-red-500"
            )}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? "+" : ""}{change}%
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      <div className="text-2xl font-bold text-foreground">
        <AnimatedValue target={numValue} prefix={prefix} suffix={suffix} />
      </div>
      {changePeriod && (
        <p className="text-[11px] text-muted-foreground/60 mt-2">{changePeriod}</p>
      )}
    </motion.div>
  )
}
