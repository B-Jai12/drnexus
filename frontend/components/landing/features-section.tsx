"use client"

import {
  Upload,
  BarChart3,
  Brain,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Reveal, StaggerContainer, StaggerItem, AnimatedDivider } from "@/components/page-transition"

const features = [
  {
    icon: Upload,
    title: "Smart Statement Parsing",
    description:
      "Upload PDF or CSV bank statements. Our engine automatically extracts, categorizes, and structures every transaction.",
    gradient: "from-emerald-500/20 to-teal-500/20",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description:
      "Visualize spending by category, merchant, time-of-day, and weekly trends with interactive charts and heatmaps.",
    gradient: "from-blue-500/20 to-cyan-500/20",
  },
  {
    icon: Brain,
    title: "ML-Powered Predictions",
    description:
      "Our machine learning models forecast your future expenses with confidence intervals and risk alerts.",
    gradient: "from-purple-500/20 to-violet-500/20",
  },
  {
    icon: TrendingUp,
    title: "Savings Optimization",
    description:
      "Get AI-generated actionable recommendations to cut unnecessary expenses and maximize your savings potential.",
    gradient: "from-orange-500/20 to-amber-500/20",
  },
  {
    icon: Shield,
    title: "Bank-Grade Security",
    description:
      "End-to-end encryption ensures your financial data is always secure. We never store raw bank credentials.",
    gradient: "from-red-500/20 to-pink-500/20",
  },
  {
    icon: Zap,
    title: "Real-Time Processing",
    description:
      "Get instant insights the moment you upload. No waiting — our pipeline processes statements in seconds.",
    gradient: "from-yellow-500/20 to-orange-500/20",
  },
]

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useTransform(y, [-100, 100], [3, -3]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [-100, 100], [-3, 3]), { stiffness: 300, damping: 30 })

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    x.set(e.clientX - rect.left - rect.width / 2)
    y.set(e.clientY - rect.top - rect.height / 2)
  }

  return (
    <StaggerItem>
      <motion.div
        className="glass-hover rounded-2xl p-8 h-full gradient-border group hover-lift cursor-default"
        style={{ rotateX, rotateY, transformPerspective: 800 }}
        onMouseMove={handleMouse}
        onMouseLeave={() => { x.set(0); y.set(0) }}
      >
        <motion.div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5`}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          <feature.icon className="w-6 h-6 text-primary" />
        </motion.div>
        <h3 className="text-lg font-semibold text-foreground mb-3 group-hover:text-primary transition-colors duration-200">{feature.title}</h3>
        <p className="text-muted-foreground leading-relaxed text-sm">{feature.description}</p>
      </motion.div>
    </StaggerItem>
  )
}

export function FeaturesSection() {
  return (
    <section className="py-24 px-6 bg-background relative">
      {/* Subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
              Everything You Need to{" "}
              <span className="gradient-text">Take Control</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
              A complete fintech analytics suite built with cutting-edge ML models and beautiful visualizations.
            </p>
          </div>
        </Reveal>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}
