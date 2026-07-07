import { cn } from "@workspace/ui/lib/utils"
import Image from "next/image"
import Link from "next/link"

const labelTransition = "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"

export function SidebarBrand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-center overflow-hidden border-b border-sidebar-border px-2">
      <Link
        href="/dashboard"
        className="flex cursor-pointer items-center justify-center rounded-lg p-1.5 transition-opacity duration-200 hover:opacity-90"
        aria-label="Home"
      >
        <Image
          src="/sdv-logo.png"
          alt="SDV"
          width={132}
          height={40}
          style={{ width: "auto", height: "auto" }}
          className={cn(
            "object-contain transition-all duration-300 ease-in-out motion-reduce:transition-none",
            collapsed ? "h-8 w-8" : "h-8 w-auto max-w-28"
          )}
          priority
        />
      </Link>
    </div>
  )
}

export { labelTransition }
