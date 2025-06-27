import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-red-100 text-red-700",
        secondary: "bg-gray-100 text-gray-700",
        success: "bg-teal-100 text-teal-700",
        warning: "bg-orange-100 text-orange-700",
        error: "bg-red-100 text-red-700",
        info: "bg-blue-100 text-blue-700",
        outline: "bg-white text-gray-700 ring-1 ring-inset ring-gray-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }