import { Button } from "@workspace/ui/components/button"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">404</p>
      <h1 className="font-display text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you requested does not exist or you may not have access to it.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  )
}
