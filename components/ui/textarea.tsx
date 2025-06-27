import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-base ring-offset-background placeholder:text-gray-400 focus:border-red-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all duration-200",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }