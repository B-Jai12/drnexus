"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Reveal, StaggerContainer, StaggerItem } from "@/components/page-transition"

const faqs = [
    {
        question: "How does Dr.Nexus analyze my bank statements?",
        answer:
            "Our ML engine uses natural language processing to parse PDF and CSV bank statements. It categorizes transactions across 10+ categories, detects recurring subscriptions, identifies spending patterns, and builds a comprehensive financial profile — all within seconds.",
    },
    {
        question: "Is my financial data safe and secure?",
        answer:
            "Absolutely. We use AES-256 encryption for data at rest and TLS 1.3 for data in transit. Your raw bank files are never stored permanently — we only retain the structured, anonymized insights. We're SOC 2 Type II compliant and undergo regular security audits.",
    },
    {
        question: "How accurate are the spending predictions?",
        answer:
            "Our prediction models achieve 88-96% accuracy depending on the amount of historical data available. The more statements you upload, the better our forecasting becomes. We use ensemble methods combining ARIMA, gradient boosting, and neural network models.",
    },
    {
        question: "Which banks are supported?",
        answer:
            "Dr.Nexus supports statements from all major Indian banks including SBI, HDFC, ICICI, Axis, Kotak, and more. We also support international formats. If your bank isn't currently supported, our parser adapts within one business day.",
    },
    {
        question: "Can I use Dr.Nexus for free?",
        answer:
            "Yes! Our free tier lets you upload up to 3 statements per month and access basic analytics and predictions. Premium plans unlock unlimited uploads, advanced AI recommendations, smart alternatives, and priority support starting at ₹299/month.",
    },
    {
        question: "How do the AI recommendations work?",
        answer:
            "Our recommendation engine analyzes your spending against anonymized benchmarks of users with similar income profiles. It identifies specific areas where you overspend, suggests cheaper alternatives (with real merchant data), and shows estimated monthly savings for each action.",
    },
]

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null)

    return (
        <section className="py-24 px-6 bg-background relative">
            <div className="max-w-3xl mx-auto">
                <Reveal>
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
                            Frequently Asked <span className="gradient-text">Questions</span>
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
                            Everything you need to know about Dr.Nexus.
                        </p>
                    </div>
                </Reveal>

                <StaggerContainer className="space-y-3">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index
                        return (
                            <StaggerItem key={index}>
                                <div className="glass-hover rounded-xl gradient-border overflow-hidden">
                                    <button
                                        onClick={() => setOpenIndex(isOpen ? null : index)}
                                        className="w-full flex items-center justify-between p-5 text-left"
                                    >
                                        <span className="font-medium text-foreground pr-4">{faq.question}</span>
                                        <motion.div
                                            animate={{ rotate: isOpen ? 180 : 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="flex-shrink-0"
                                        >
                                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                        </motion.div>
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
                                                    {faq.answer}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </StaggerItem>
                        )
                    })}
                </StaggerContainer>
            </div>
        </section>
    )
}
