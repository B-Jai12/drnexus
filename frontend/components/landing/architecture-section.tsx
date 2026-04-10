"use client"

import { FileText, Cpu, BarChart3, Lightbulb } from "lucide-react"
import { motion } from "framer-motion"
import { Reveal, StaggerContainer, StaggerItem } from "@/components/page-transition"

const steps = [
  {
    icon: FileText,
    title: "Upload",
    description: "Drop your bank statement (PDF/CSV)",
    step: "01",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Cpu,
    title: "Process",
    description: "ML engine parses and categorizes data",
    step: "02",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: BarChart3,
    title: "Analyze",
    description: "Generate deep visual analytics",
    step: "03",
    color: "from-purple-500 to-violet-500",
  },
  {
    icon: Lightbulb,
    title: "Optimize",
    description: "Get AI-driven savings recommendations",
    step: "04",
    color: "from-orange-500 to-amber-500",
  },
]

export function ArchitectureSection() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/[0.02]" />

      {/* Decorative lines */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="max-w-6xl mx-auto relative">
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
              How <span className="gradient-text">Dr.Nexus</span> Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
              From raw bank data to actionable intelligence in four simple steps.
            </p>
          </div>
        </Reveal>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Animated connecting line (desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-[12%] right-[12%] h-px">
            <motion.div
              className="h-full bg-gradient-to-r from-primary/40 via-chart-2/40 to-primary/40"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeInOut" }}
              style={{ originX: 0 }}
            />
          </div>

          {steps.map((step) => (
            <StaggerItem key={step.title}>
              <motion.div
                className="relative z-10"
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <div className="glass-hover rounded-2xl p-8 text-center h-full gradient-border">
                  <div className="text-5xl font-bold text-primary/10 mb-4">{step.step}</div>
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.color} opacity-20 animate-pulse-ring`} />
                    <div className="absolute inset-1 rounded-xl bg-card flex items-center justify-center">
                      <step.icon className="w-7 h-7 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}
