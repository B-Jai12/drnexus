"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Upload, FileText, CheckCircle2, AlertCircle,
  Sparkles, BarChart3, Lightbulb,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { StaggerContainer, StaggerItem } from "@/components/page-transition"
import { toast } from "sonner"
import { processStatementUpload } from "@/src/services/uploadService"
import { useAppStore } from "@/lib/store"

type UploadState = "idle" | "uploading" | "processing" | "success" | "error"

const ACCEPTED_TYPES = [".pdf", ".csv", ".xlsx", ".jpg", ".png"]
const ML_API_BASE_URL =
  process.env.NEXT_PUBLIC_ML_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8000"

const processingSteps = [
  { label: "Uploading file",          description: "Securely transferring your statement" },
  { label: "Extracting transactions", description: "OCR + ML engine parsing your data" },
  { label: "Categorising entries",    description: "TF-IDF classifier running" },
  { label: "Generating AI insights",  description: "Gemini AI writing recommendations" },
]

export default function UploadPage() {
  const router = useRouter()
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion)
  const [state, setState]           = useState<UploadState>("idle")
  const [progress, setProgress]     = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [dragOver, setDragOver]     = useState(false)
  const [fileName, setFileName]     = useState("")
  const [wasAiGenerated, setWasAiGenerated] = useState(false)
  const [errorMsg, setErrorMsg]     = useState("")

  const processRealUpload = useCallback(async (file: File) => {
    setFileName(file.name)
    setState("uploading")
    setProgress(30)
    setCurrentStep(0)
    setWasAiGenerated(false)

    try {
      // Step 1 → uploading
      await _delay(400)
      setProgress(100)
      setState("processing")
      setCurrentStep(1)   // Extracting

      // Call backend
      const data = await processStatementUpload(file)
      setCurrentStep(2)   // Categorising
      console.log("[Upload] Backend response:", data)

      setCurrentStep(3)   // Gemini insights
      await _delay(600)   // Brief pause so user sees this step

      // Save full result (includes recommendations from Gemini) to localStorage
      localStorage.setItem("drnexus_latest_analysis", JSON.stringify(data))

      // Track if Gemini actually ran
      const aiGenerated = data?.recommendations?.ai_generated === true
      setWasAiGenerated(aiGenerated)

      setState("success")
      bumpDataVersion()
      toast.success(`Statement processed! ${Number(data?.transaction_count || data?.summary?.transaction_count || 0)} transactions imported.`, {
        description: aiGenerated
          ? "Gemini AI recommendations are ready."
          : "Your financial insights are ready."
      })

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      console.error("[Upload] Error:", error)
      setErrorMsg(msg)
      setState("error")

      toast.error("Processing failed", { description: msg })
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processRealUpload(file)
  }, [processRealUpload])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processRealUpload(file)
  }, [processRealUpload])

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      <StaggerContainer>
        <StaggerItem>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Upload Statement</h1>
            <p className="text-muted-foreground mt-1">
              Upload your bank statement for AI-powered analysis
            </p>
          </div>
        </StaggerItem>

        <StaggerItem>
          <AnimatePresence mode="wait">

            {/* ── Idle ── */}
            {state === "idle" && (
              <motion.div key="idle"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="mt-6">
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 ${
                    dragOver ? "border-primary bg-primary/5 glow-md" : "border-border hover:border-primary/40 hover:bg-muted/10"
                  }`}
                >
                  <input type="file" accept=".pdf,.csv,.xlsx,.jpg,.jpeg,.png"
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="flex flex-col items-center py-20 px-6">
                    <motion.div
                      animate={dragOver ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                      <Upload className="w-10 h-10 text-primary" />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {dragOver ? "Drop your file here" : "Drag & drop your statement"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 text-center">
                      Supports PDF, CSV, XLSX and bank statement photos (JPG, PNG)
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap justify-center">
                      {ACCEPTED_TYPES.map((type) => (
                        <span key={type} className="px-2 py-1 rounded-md bg-muted/30 border border-border/50">{type}</span>
                      ))}
                    </div>
                    {/* Gemini badge */}
                    <div className="mt-6 flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-full">
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span className="text-[11px] text-primary font-medium">Gemini AI recommendations included</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Uploading ── */}
            {state === "uploading" && (
              <motion.div key="uploading"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="glass rounded-2xl p-8 text-center gradient-border mt-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Uploading {fileName}</h3>
                <p className="text-sm text-muted-foreground mb-6">Securely transferring your file...</p>
                <div className="w-full max-w-md mx-auto h-2 rounded-full bg-muted/30 overflow-hidden">
                  <motion.div className="h-full rounded-full bg-primary"
                    style={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                </div>
                <p className="text-sm text-muted-foreground mt-3">{Math.round(progress)}%</p>
              </motion.div>
            )}

            {/* ── Processing ── */}
            {state === "processing" && (
              <motion.div key="processing"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="glass rounded-2xl p-8 gradient-border mt-6">
                <div className="text-center mb-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-foreground">Processing your bank statement...</h3>
                  <p className="text-sm text-muted-foreground mt-1">this may take up to 60 seconds. ML + Gemini AI is analysing your data.</p>
                </div>
                <div className="max-w-md mx-auto space-y-4">
                  {processingSteps.map((step, i) => (
                    <motion.div key={step.label}
                      initial={{ opacity: 0.4 }} animate={{ opacity: i <= currentStep ? 1 : 0.4 }}
                      className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        i < currentStep  ? "bg-primary text-primary-foreground" :
                        i === currentStep ? "bg-primary/20 text-primary animate-pulse" :
                                            "bg-muted/30 text-muted-foreground"
                      }`}>
                        {i < currentStep
                          ? <CheckCircle2 className="w-4 h-4" />
                          : <span className="text-xs font-bold">{i + 1}</span>
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Error ── */}
            {state === "error" && (
              <motion.div key="error"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="glass rounded-2xl p-8 text-center border border-red-500/30 mt-6">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Upload Failed</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Could not process your statement.
                </p>
                {errorMsg && (
                  <p className="text-xs text-red-400/80 mb-6 font-mono bg-red-500/5 rounded-lg px-3 py-2">
                    {errorMsg}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mb-6">
                  Make sure your Python backend is running on{" "}
                  <code className="text-primary">{ML_API_BASE_URL}</code>
                </p>
                <Button onClick={() => { setState("idle"); setErrorMsg("") }}>Try Again</Button>
              </motion.div>
            )}

            {/* ── Success ── */}
            {state === "success" && (
              <motion.div key="success"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="glass rounded-2xl p-8 text-center gradient-border mt-6">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
                  className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </motion.div>

                <h3 className="text-xl font-semibold text-foreground mb-2">Analysis Complete!</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Your statement has been processed successfully
                </p>

                {/* Gemini badge on success */}
                {wasAiGenerated && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full mb-6">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[11px] text-primary font-semibold">Gemini AI recommendations generated</span>
                  </motion.div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
                  {/* Primary: go to recommendations */}
                  <Button asChild className="glow-sm">
                    <Link href="/dashboard/recommendations">
                      <Lightbulb className="w-4 h-4 mr-2" />
                      View Recommendations
                    </Link>
                  </Button>
                  {/* Secondary: overview dashboard */}
                  <Button variant="outline" className="bg-transparent" asChild>
                    <Link href="/dashboard/overview">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      View Dashboard
                    </Link>
                  </Button>
                  <Button variant="ghost" className="text-muted-foreground"
                    onClick={() => { setState("idle"); setProgress(0); setCurrentStep(0) }}>
                    Upload Another
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </StaggerItem>
      </StaggerContainer>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────
function _delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}