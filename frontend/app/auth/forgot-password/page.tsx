"use client"

import Link from "next/link"
import { Brain, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 relative">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-chart-2/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-xl">Dr.Nexus</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground mb-2">Reset your password</h1>
          <p className="text-muted-foreground">{"Enter your email and we'll send you a reset link"}</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="rahul@example.com"
                className="h-11 rounded-xl bg-background"
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl text-base">
              Send Reset Link
            </Button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
