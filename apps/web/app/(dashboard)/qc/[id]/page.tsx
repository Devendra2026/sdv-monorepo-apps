import { QcReviewSection } from "@/app/(dashboard)/qc/[id]/qc-review-section"
import { QcPageSkeleton } from "@/components/shared/qc-route-skeleton"
import { Suspense, use } from "react"

export default function QcReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <Suspense fallback={<QcPageSkeleton variant="review" />}>
      <QcReviewSection id={id} />
    </Suspense>
  )
}
