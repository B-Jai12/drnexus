"use client"

import { useEffect, useState } from "react"
import { User, Mail, Lock, Shield, Eye, Moon, Sun, Bell, Trash2, Save, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { motion } from "framer-motion"
import { StaggerContainer, StaggerItem } from "@/components/page-transition"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { apiGet } from "@/src/services/api"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [twoFactor, setTwoFactor] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoadingProfile(true)
      try {
        const profile = await apiGet<{ name: string; email: string }>("/api/user/profile")
        setName(profile.name || "")
        setEmail(profile.email || "")
      } catch (err) {
        setProfileError(err instanceof Error ? err.message : "Failed to load profile.")
      } finally {
        setLoadingProfile(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 1000))
    setSaving(false)
    toast.success("Settings saved successfully!", { description: "Your profile has been updated." })
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {profileError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
          Failed to load profile: {profileError}
        </div>
      )}
      {loadingProfile && <div className="text-sm text-muted-foreground">Loading profile...</div>}
      <StaggerContainer>
        <StaggerItem>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your account preferences</p>
          </div>
        </StaggerItem>

        {/* Profile Section */}
        <StaggerItem>
          <div className="glass-hover rounded-2xl p-6 gradient-border mt-6">
            <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Profile
            </h3>
            <p className="text-sm text-muted-foreground mb-6">Update your personal information</p>

            <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl flex-shrink-0">
                {name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl bg-background" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl bg-background" />
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* Appearance */}
        <StaggerItem>
          <div className="glass-hover rounded-2xl p-6 gradient-border">
            <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              {theme === "dark" ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
              Appearance
            </h3>
            <p className="text-sm text-muted-foreground mb-6">Customize your visual experience</p>

            <div className="grid grid-cols-2 gap-3">
              {(["light", "dark"] as const).map((t) => (
                <motion.button
                  key={t}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTheme(t)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${theme === t
                      ? "border-primary bg-primary/5"
                      : "border-border/50 bg-muted/10 hover:border-border"
                    }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {t === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    <span className="text-sm font-medium capitalize text-foreground">{t} Mode</span>
                  </div>
                  <div className={`h-6 rounded-md ${t === "dark" ? "bg-gray-900" : "bg-gray-100"} flex items-center px-2 gap-1`}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`h-2 rounded-full flex-1 ${t === "dark" ? "bg-gray-700" : "bg-gray-300"}`} />
                    ))}
                  </div>
                  {theme === t && (
                    <div className="flex items-center gap-1 text-xs text-primary mt-2">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </StaggerItem>

        {/* Notifications */}
        <StaggerItem>
          <div className="glass-hover rounded-2xl p-6 gradient-border">
            <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Notifications
            </h3>
            <p className="text-sm text-muted-foreground mb-6">Control how you receive alerts</p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/10">
                <div>
                  <p className="text-sm font-medium text-foreground">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">Weekly spending summaries and alerts</p>
                </div>
                <Switch checked={emailNotifs} onCheckedChange={setEmailNotifs} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/10">
                <div>
                  <p className="text-sm font-medium text-foreground">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">Real-time overspending alerts</p>
                </div>
                <Switch checked={pushNotifs} onCheckedChange={setPushNotifs} />
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* Security */}
        <StaggerItem>
          <div className="glass-hover rounded-2xl p-6 gradient-border">
            <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Security
            </h3>
            <p className="text-sm text-muted-foreground mb-6">Account security settings</p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/10">
                <div>
                  <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                </div>
                <Switch
                  checked={twoFactor}
                  onCheckedChange={(v) => {
                    setTwoFactor(v)
                    toast(v ? "2FA enabled" : "2FA disabled", {
                      description: v ? "Your account is now more secure" : "Two-factor authentication has been disabled",
                    })
                  }}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/10">
                <div>
                  <p className="text-sm font-medium text-foreground">Change Password</p>
                  <p className="text-xs text-muted-foreground">Update your account password</p>
                </div>
                <Button variant="outline" size="sm" className="bg-transparent">
                  <Lock className="w-3 h-3 mr-2" /> Change
                </Button>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* Data Privacy */}
        <StaggerItem>
          <div className="glass-hover rounded-2xl p-6 gradient-border">
            <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Data Privacy
            </h3>
            <p className="text-sm text-muted-foreground mb-6">Manage your data and privacy</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/10">
                <div>
                  <p className="text-sm font-medium text-foreground">Export Your Data</p>
                  <p className="text-xs text-muted-foreground">Download all your financial data as CSV</p>
                </div>
                <Button variant="outline" size="sm" className="bg-transparent" onClick={() => toast.success("Data export started", { description: "You'll receive a download link shortly." })}>
                  Export
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <div>
                  <p className="text-sm font-medium text-red-400">Delete Account</p>
                  <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
                </div>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-3 h-3 mr-2" /> Delete
                </Button>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* Save Button */}
        <StaggerItem>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="glow-sm px-8">
              {saving ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"
                />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </div>
  )
}
