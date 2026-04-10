"use client"

import { LandingNavbar } from "@/components/landing/landing-navbar"
import { HeroSection } from "@/components/landing/hero-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { StatsBanner } from "@/components/landing/stats-banner"
import { ArchitectureSection } from "@/components/landing/architecture-section"
import { TestimonialsSection } from "@/components/landing/testimonials-section"
import { FAQSection } from "@/components/landing/faq-section"
import { Footer } from "@/components/landing/footer"
import { ScrollProgressBar, AnimatedDivider } from "@/components/page-transition"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background noise-bg">
      <ScrollProgressBar />
      <LandingNavbar />
      <HeroSection />
      <AnimatedDivider />
      <div id="features">
        <FeaturesSection />
      </div>
      <StatsBanner />
      <div id="how-it-works">
        <ArchitectureSection />
      </div>
      <AnimatedDivider />
      <div id="testimonials">
        <TestimonialsSection />
      </div>
      <AnimatedDivider />
      <div id="faq">
        <FAQSection />
      </div>
      <Footer />
    </main>
  )
}
