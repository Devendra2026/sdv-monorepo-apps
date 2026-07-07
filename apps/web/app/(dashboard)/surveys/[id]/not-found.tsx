import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"

export default function SurveyNotFound() {
  return (
    <div className="space-y-4 py-8">
      <EmptyState
        title="Survey not found"
        description="This record may have been deleted or is outside your assigned scope."
      />
      <Button asChild variant="outline" className="w-fit cursor-pointer rounded-xl">
        <Link href="/surveys/registry">Back to registry</Link>
      </Button>
    </div>
  )
}
