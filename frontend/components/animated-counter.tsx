"use client"

import { useEffect, useState, useRef } from "react"

interface AnimatedCounterProps {
    target: number
    prefix?: string
    suffix?: string
    duration?: number
    decimals?: number
}

export function AnimatedCounter({
    target,
    prefix = "",
    suffix = "",
    duration = 2000,
    decimals = 0,
}: AnimatedCounterProps) {
    const [count, setCount] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const ref = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setIsVisible(true)
            },
            { threshold: 0.5 }
        )
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (!isVisible) return
        const steps = 60
        const increment = target / steps
        let current = 0
        const timer = setInterval(() => {
            current += increment
            if (current >= target) {
                setCount(target)
                clearInterval(timer)
            } else {
                setCount(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.floor(current))
            }
        }, duration / steps)
        return () => clearInterval(timer)
    }, [target, isVisible, duration, decimals])

    return (
        <span ref={ref}>
            {prefix}
            {decimals > 0 ? count.toFixed(decimals) : count.toLocaleString()}
            {suffix}
        </span>
    )
}
