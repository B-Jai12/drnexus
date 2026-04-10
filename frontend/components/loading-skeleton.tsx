"use client"

import { cn } from "@/lib/utils"

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <div className={cn("animate-shimmer rounded-xl bg-muted/40", className)} style={style} />
    )
}

export function CardSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("glass rounded-2xl p-6 space-y-4", className)}>
            <div className="flex items-start justify-between">
                <Shimmer className="w-10 h-10 rounded-xl" />
                <Shimmer className="w-16 h-6 rounded-full" />
            </div>
            <Shimmer className="w-24 h-4" />
            <Shimmer className="w-32 h-8" />
        </div>
    )
}

export function ChartSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("glass rounded-2xl p-6", className)}>
            <Shimmer className="w-40 h-5 mb-2" />
            <Shimmer className="w-64 h-4 mb-6" />
            <div className="flex items-end gap-2 h-56">
                {[40, 65, 45, 80, 55, 70].map((h, i) => (
                    <Shimmer
                        key={i}
                        className="flex-1 rounded-t-lg"
                        style={{ height: `${h}%` } as React.CSSProperties}
                    />
                ))}
            </div>
        </div>
    )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border">
                <div className="flex gap-3">
                    <Shimmer className="flex-1 h-10" />
                    <Shimmer className="w-40 h-10" />
                    <Shimmer className="w-32 h-10" />
                </div>
            </div>
            <div className="divide-y divide-border/50">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3">
                        <Shimmer className="w-20 h-4" />
                        <Shimmer className="w-28 h-4" />
                        <Shimmer className="flex-1 h-4 hidden md:block" />
                        <Shimmer className="w-20 h-6 rounded-full" />
                        <Shimmer className="w-20 h-4 ml-auto" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function StatCardSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    )
}

export function PageHeaderSkeleton() {
    return (
        <div className="space-y-2">
            <Shimmer className="w-48 h-8" />
            <Shimmer className="w-72 h-4" />
        </div>
    )
}
