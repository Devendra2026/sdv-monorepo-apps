import { cn } from "@workspace/ui/lib/utils"
import Image from "next/image"
import Link from "next/link"

const labelTransition = "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"

export function SidebarBrand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex h-20 shrink-0 items-center justify-center overflow-hidden border-b border-sidebar-border px-2">
      <Link
        href="/dashboard"
        className="flex cursor-pointer items-center justify-center rounded-lg p-1.5 transition-opacity duration-200 hover:opacity-90"
        aria-label="Home"
      >
        <span
          className={cn(
            "relative block h-8 shrink-0 transition-all duration-300 ease-in-out motion-reduce:transition-none",
            collapsed ? "w-8" : "w-33 max-w-33"
          )}
        >
          <Image
            src="/images/sdv-logo.png"
            alt="SDV"
            fill
            sizes="132px"
            priority
            className="object-contain drop-shadow-sm"
          />
        </span>
      </Link>
    </div>
  )
}

export { labelTransition }
