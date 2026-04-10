"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged, User } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase"

export function useAuth(redirectTo = "/auth/login") {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe = () => {}
    try {
      const auth = getFirebaseAuth()
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser)
        } else {
          setUser(null)
          router.replace(redirectTo)
        }
        setLoading(false)
      })
    } catch {
      setUser(null)
      setLoading(false)
      router.replace(redirectTo)
    }
    return () => unsubscribe()
  }, [router, redirectTo])

  return { user, loading }
}

export function useRequireAuth() {
  return useAuth("/auth/login")
}