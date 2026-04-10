"use client"

import Link from "next/link"
import { Brain, Github, Twitter, Linkedin } from "lucide-react"
import { Reveal } from "@/components/page-transition"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background relative overflow-hidden">
      {/* Subtle gradient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
              <div className="md:col-span-1">
                <Link href="/" className="flex items-center gap-2 mb-4 group">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:glow-sm transition-shadow">
                    <Brain className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-foreground text-lg">Dr.Nexus</span>
                </Link>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  AI-powered financial analytics for smarter spending decisions.
                </p>
                <div className="flex items-center gap-3">
                  {[
                    { icon: Twitter, label: "Twitter" },
                    { icon: Github, label: "GitHub" },
                    { icon: Linkedin, label: "LinkedIn" },
                  ].map((social) => (
                    <button
                      key={social.label}
                      className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                      aria-label={social.label}
                    >
                      <social.icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4 text-sm">Product</h4>
                <ul className="space-y-3">
                  {[
                    { label: "Dashboard", href: "/dashboard/overview" },
                    { label: "Analytics", href: "/dashboard/analytics" },
                    { label: "Predictions", href: "/dashboard/predictions" },
                    { label: "Upload", href: "/dashboard/upload" },
                  ].map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4 text-sm">Company</h4>
                <ul className="space-y-3">
                  {["About", "Careers", "Blog", "Contact"].map((item) => (
                    <li key={item}>
                      <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4 text-sm">Legal</h4>
                <ul className="space-y-3">
                  {["Privacy Policy", "Terms of Service", "Security", "Compliance"].map((item) => (
                    <li key={item}>
                      <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>

          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 Dr.Nexus. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Built with{" "}
              <span className="gradient-text font-medium">Next.js, TypeScript & TailwindCSS</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
