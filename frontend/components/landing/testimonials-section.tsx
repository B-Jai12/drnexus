"use client"

import { Star, Quote } from "lucide-react"
import { motion } from "framer-motion"
import { Reveal, StaggerContainer, StaggerItem } from "@/components/page-transition"

const testimonials = [
    {
        name: "Priya Sharma",
        role: "Software Engineer",
        content:
            "Dr.Nexus helped me identify ₹8,000 in unnecessary subscriptions I didn't even know I was paying for. The AI recommendations are incredibly specific and actionable.",
        avatar: "PS",
        rating: 5,
        savings: "₹8,000/mo",
    },
    {
        name: "Arjun Patel",
        role: "Startup Founder",
        content:
            "The spending heatmap is a game changer. I can now see exactly when I overspend and the prediction engine is eerily accurate. Best financial tool I've used.",
        avatar: "AP",
        rating: 5,
        savings: "₹12,500/mo",
    },
    {
        name: "Kavitha Reddy",
        role: "Product Manager",
        content:
            "Uploaded my HDFC bank statement and within seconds had a complete breakdown of my spending. The smart alternatives feature saved me from expensive delivery apps.",
        avatar: "KR",
        rating: 5,
        savings: "₹5,200/mo",
    },
]

export function TestimonialsSection() {
    return (
        <section className="py-24 px-6 bg-background relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 left-0 w-[300px] h-[300px] bg-chart-2/5 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-6xl mx-auto relative">
                <Reveal>
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
                            Trusted by <span className="gradient-text">Smart Savers</span>
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
                            See how professionals are using Dr.Nexus to transform their financial habits.
                        </p>
                    </div>
                </Reveal>

                <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {testimonials.map((testimonial) => (
                        <StaggerItem key={testimonial.name}>
                            <motion.div
                                className="glass-hover rounded-2xl p-6 h-full flex flex-col gradient-border group hover-lift"
                                whileHover={{ y: -4 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                {/* Quote icon */}
                                <Quote className="w-8 h-8 text-primary/20 mb-4" />

                                {/* Content */}
                                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
                                    &ldquo;{testimonial.content}&rdquo;
                                </p>

                                {/* Rating */}
                                <div className="flex items-center gap-1 mb-4">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={`w-4 h-4 ${star <= testimonial.rating
                                                ? "text-yellow-400 fill-yellow-400"
                                                : "text-muted-foreground/20"
                                                }`}
                                        />
                                    ))}
                                </div>

                                {/* Author */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                                            {testimonial.avatar}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                                            <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-primary">{testimonial.savings}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">saved</p>
                                    </div>
                                </div>
                            </motion.div>
                        </StaggerItem>
                    ))}
                </StaggerContainer>
            </div>
        </section>
    )
}
