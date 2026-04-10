"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  TrendingUp,
  Lightbulb,
  Upload,
  Settings,
  Brain,
  X,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useEffect, useState } from "react"
import { onAuthStateChanged, signOut, User } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase"
import { toast } from "sonner"

const navSections = [
  {
    label: "Main",
    items: [
      { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
      { label: "Transactions", href: "/dashboard/transactions", icon: ArrowLeftRight },
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Predictions", href: "/dashboard/predictions", icon: TrendingUp },
      { label: "Recommendations", href: "/dashboard/recommendations", icon: Lightbulb },
    ],
  },
  {
    label: "Actions",
    items: [
      { label: "Upload Statement", href: "/dashboard/upload", icon: Upload },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let unsubscribe = () => {}
    try {
      const auth = getFirebaseAuth()
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser)
      })
    } catch {
      setUser(null)
    }
    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    try {
      const auth = getFirebaseAuth()
      await signOut(auth)
      toast.success("Logged out successfully")
      router.push("/auth/login")
    } catch {
      toast.error("Failed to log out")
    }
  }

  const getInitials = () => {
    if (user?.displayName) {
      return user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return "U"
  }

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User"
  const displayEmail = user?.email || ""

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            role="button"
            tabIndex={0}
            aria-label="Close sidebar"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:glow-sm transition-shadow">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sidebar-foreground">Dr.Nexus</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground bg-transparent"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
          {navSections.map((section) => (
            <div key={section.label} className="mb-6">
              <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold px-3 mb-2">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                        isActive
                          ? "text-primary"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute inset-0 bg-sidebar-accent rounded-xl"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                      <item.icon className="w-5 h-5 flex-shrink-0 relative z-10" />
                      <span className="relative z-10">{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="activeDot"
                          className="w-1.5 h-1.5 rounded-full bg-primary ml-auto relative z-10"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User section — ✅ FIXED: Removed Sparkles/Pro Plan icon */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sidebar-accent/30">
            <Avatar className="w-8 h-8">
              {user?.photoURL && <AvatarImage src={user.photoURL} alt={displayName} />}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{displayEmail}</p>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-sidebar-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>
    </>
  )
}