import React from 'react'

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-8">
      <div className="w-full max-w-4xl space-y-6">
        <div className="h-8 w-1/3 animate-pulse rounded-md bg-muted"></div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="h-32 animate-pulse rounded-lg bg-muted"></div>
          <div className="h-32 animate-pulse rounded-lg bg-muted"></div>
          <div className="h-32 animate-pulse rounded-lg bg-muted"></div>
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-muted"></div>
      </div>
    </div>
  )
}
