"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Navbar } from "@/components/dashboard/navbar"
import { PageTransition } from "@/components/page-transition"
import { Brain } from "lucide-react"

function AuthLoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Brain className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <div className="absolute -inset-1 rounded-2xl border-2 border-primary/20 animate-ping" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Verifying your session...
          </p>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    let unsubscribe = () => {}
    let refreshInterval: ReturnType<typeof setInterval> | null = null

    const refreshToken = async (user: any) => {
      try {
        // force=true gets a brand-new token even if cached one still works
        const idToken = await user.getIdToken(true)
        document.cookie = `firebase-session=${idToken}; path=/; max-age=3600; SameSite=Strict`
      } catch { /* silent — user may have logged out */ }
    }

    try {
      const auth = getFirebaseAuth()
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          const idToken = await user.getIdToken()
          document.cookie = `firebase-session=${idToken}; path=/; max-age=3600; SameSite=Strict`
          setAuthenticated(true)

          // Refresh token every 50 minutes (before the 1-hour expiry)
          if (refreshInterval) clearInterval(refreshInterval)
          refreshInterval = setInterval(() => refreshToken(user), 50 * 60 * 1000)
        } else {
          // Clear session cookie
          document.cookie =
            "firebase-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
          setAuthenticated(false)
          if (refreshInterval) clearInterval(refreshInterval)
          router.replace("/auth/login")
        }
        setAuthChecked(true)
      })
    } catch {
      setAuthenticated(false)
      setAuthChecked(true)
      router.replace("/auth/login")
    }

    return () => {
      unsubscribe()
      if (refreshInterval) clearInterval(refreshInterval)
    }
  }, [router])

  // Show loading spinner while Firebase checks auth state
  if (!authChecked) {
    return <AuthLoadingScreen />
  }

  // Don't render anything if not authenticated (redirect is happening)
  if (!authenticated) {
    return <AuthLoadingScreen />
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
}