    "use client"

    import { Reveal } from "@/components/page-transition"
    import { AnimatedCounter } from "@/components/animated-counter"

    const stats = [
        { label: "Users Trust Dr.Nexus", value: 15000, prefix: "", suffix: "+" },
        { label: "Total Savings Generated", value: 2.4, prefix: "₹", suffix: "Cr+" },
        { label: "Statements Processed", value: 50000, prefix: "", suffix: "+" },
        { label: "Average Savings/User", value: 6800, prefix: "₹", suffix: "/mo" },
    ]

    export function StatsBanner() {
        return (
            <section className="py-16 px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-chart-2/5 to-primary/5" />
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

                <div className="max-w-6xl mx-auto relative">
                    <Reveal>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            {stats.map((stat) => (
                                <div key={stat.label} className="text-center">
                                    <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                                        <AnimatedCounter target={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                                    </div>
                                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </Reveal>
                </div>
            </section>
        )
    }
