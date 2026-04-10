"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Menu, Bell, Sun, Moon, Search, X, Settings,
  LogOut, User, ChevronRight, TrendingUp, ArrowLeftRight,
  BarChart3, Upload, Check,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAppStore } from "@/lib/store"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase"
import { toast } from "sonner"

interface NavbarProps {
  onMenuClick: () => void
}

const quickLinks = [
  { label: "Overview", href: "/dashboard/overview", icon: TrendingUp },
  { label: "Transactions", href: "/dashboard/transactions", icon: ArrowLeftRight },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Upload Statement", href: "/dashboard/upload", icon: Upload },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function Navbar({ onMenuClick }: NavbarProps) {
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  const notifications = useAppStore((s) => s.notifications)
  const clearNotification = useAppStore((s) => s.clearNotification)
  const unreadCount = notifications.filter((n) => !n.read).length

  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pageTitle = getPageTitle(pathname)

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

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotificationsOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true) }
      if (e.key === "Escape") { setSearchOpen(false); setSearchQuery("") }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus()
  }, [searchOpen])

  const filteredLinks = quickLinks.filter((link) =>
    link.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleMarkAllRead = useCallback(() => {
    notifications.forEach((n) => { if (!n.read) clearNotification(n.id) })
  }, [notifications, clearNotification])

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

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User"
  const displayEmail = user?.email || ""
  const getInitials = () => {
    if (user?.displayName) return user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    if (user?.email) return user.email.slice(0, 2).toUpperCase()
    return "U"
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-2xl">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 active:scale-95"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-muted-foreground/70">Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
              <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
            </div>
            <h1 className="sm:hidden text-sm font-semibold text-foreground">{pageTitle}</h1>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 h-9 px-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border/80 text-muted-foreground transition-all duration-200 group"
            >
              <Search className="w-3.5 h-3.5 group-hover:text-foreground transition-colors" />
              <span className="hidden md:inline text-xs">Search...</span>
              <kbd className="hidden lg:inline text-[10px] bg-background/80 rounded-[4px] px-1.5 py-0.5 border border-border/60 font-mono text-muted-foreground/60 ml-4">⌘K</kbd>
            </button>

            <div className="hidden sm:block w-px h-5 bg-border/60 mx-1" />

            {/* Theme toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
            >
              {mounted && (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={theme}
                    initial={{ y: -12, opacity: 0, rotate: -90 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: 12, opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.button>

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { setNotificationsOpen((p) => !p); setProfileOpen(false) }}
                className="relative flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] font-bold text-white ring-2 ring-background"
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </motion.button>

              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-[340px] sm:w-[380px] bg-popover/95 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-2xl overflow-hidden z-50"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                        {unreadCount > 0 && (
                          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">{unreadCount}</span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors font-medium">
                          <Check className="w-3 h-3" /> Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4">
                          <Bell className="w-8 h-8 text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((n, i) => (
                          <motion.button
                            key={n.id}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => clearNotification(n.id)}
                            className={cn(
                              "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors border-b border-border/20 last:border-0",
                              !n.read && "bg-primary/[0.03]"
                            )}
                          >
                            <div className="mt-1 flex-shrink-0">
                              <div className={cn("w-2 h-2 rounded-full",
                                n.read ? "bg-muted-foreground/20"
                                  : n.type === "warning" ? "bg-amber-400"
                                    : n.type === "success" ? "bg-emerald-400"
                                      : n.type === "error" ? "bg-red-400" : "bg-blue-400"
                              )} />
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <p className="text-[13px] font-medium text-foreground leading-tight">{n.title}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-muted-foreground/50 font-medium">{formatTimeAgo(n.timestamp)}</p>
                            </div>
                          </motion.button>
                        ))
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="border-t border-border/40">
                        <Link href="/dashboard/settings" onClick={() => setNotificationsOpen(false)}
                          className="flex items-center justify-center gap-1.5 py-2.5 text-xs text-primary font-medium hover:bg-muted/30 transition-colors">
                          View all <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="hidden sm:block w-px h-5 bg-border/60 mx-1" />

            {/* Profile — Pro Plan badge REMOVED */}
            <div ref={profileRef} className="relative">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => { setProfileOpen((p) => !p); setNotificationsOpen(false) }}
                className="flex items-center gap-2.5 h-9 pl-1.5 pr-2 sm:pr-3 rounded-xl hover:bg-muted/60 transition-all duration-200 group"
              >
                <div className="relative">
                  <Avatar className="w-7 h-7 ring-2 ring-border/40 group-hover:ring-primary/30 transition-all">
                    {user?.photoURL && <AvatarImage src={user.photoURL} alt={displayName} />}
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xs font-semibold">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-background" />
                </div>
                {/* ✅ FIXED: Removed "Pro Plan" subtitle — now shows only the name */}
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-foreground leading-tight truncate max-w-[100px]">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight truncate max-w-[100px]">{displayEmail}</p>
                </div>
              </motion.button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-60 bg-popover/95 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-2xl overflow-hidden z-50"
                  >
                    {/* Profile header — Pro Plan badge REMOVED */}
                    <div className="px-4 py-3 border-b border-border/40">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          {user?.photoURL && <AvatarImage src={user.photoURL} alt={displayName} />}
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-sm font-semibold">
                            {getInitials()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                          {/* ✅ FIXED: Removed "Pro Plan" badge entirely */}
                          <p className="text-[11px] text-muted-foreground truncate">{displayEmail}</p>
                        </div>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                      {[
                        { icon: User, label: "Profile", href: "/dashboard/settings" },
                        { icon: Settings, label: "Settings", href: "/dashboard/settings" },
                      ].map((item) => (
                        <Link key={item.label} href={item.href} onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground/80 hover:text-foreground hover:bg-muted/40 transition-all duration-150">
                          <item.icon className="w-4 h-4 text-muted-foreground" />
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    {/* Logout */}
                    <div className="border-t border-border/40 py-1.5">
                      <button
                        onClick={() => { setProfileOpen(false); handleLogout() }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-all duration-150"
                      >
                        <LogOut className="w-4 h-4" />
                        Log out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </header>

      {/* Command Palette */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-md flex items-start justify-center pt-[15vh]"
            onClick={() => { setSearchOpen(false); setSearchQuery("") }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[520px] mx-4 bg-popover/95 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 h-14 border-b border-border/40">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pages, transactions, actions..."
                  className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/60 text-sm"
                />
                <button
                  onClick={() => { setSearchOpen(false); setSearchQuery("") }}
                  className="flex items-center justify-center text-[10px] font-medium bg-muted/50 text-muted-foreground px-2 py-1 rounded-md border border-border/40 hover:bg-muted/80 transition-colors"
                >ESC</button>
              </div>
              <div className="p-2">
                {searchQuery === "" && (
                  <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">Quick Navigation</p>
                )}
                {filteredLinks.length > 0 ? filteredLinks.map((link, i) => (
                  <Link key={link.href} href={link.href} onClick={() => { setSearchOpen(false); setSearchQuery("") }}>
                    <motion.div
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                        pathname === link.href ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <link.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{link.label}</span>
                      {pathname === link.href && <span className="ml-auto text-[10px] text-primary/60 font-medium">Current</span>}
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 ml-auto" />
                    </motion.div>
                  </Link>
                )) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Search className="w-6 h-6 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No results for &ldquo;{searchQuery}&rdquo;</p>
                  </div>
                )}
              </div>
              <div className="px-4 py-2.5 border-t border-border/30 flex items-center gap-4">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                  <kbd className="bg-muted/40 rounded px-1 py-0.5 font-mono border border-border/30">↑</kbd>
                  <kbd className="bg-muted/40 rounded px-1 py-0.5 font-mono border border-border/30">↓</kbd>
                  <span className="ml-0.5">Navigate</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                  <kbd className="bg-muted/40 rounded px-1 py-0.5 font-mono border border-border/30">↵</kbd>
                  <span className="ml-0.5">Open</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  const last = segments[segments.length - 1] || "overview"
  return last.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}