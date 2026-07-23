import { QcCommandSection } from "@/app/(dashboard)/qc/qc-command-section"
import { bucketNowMs } from "@/lib/now-ms"

export default function QcCommandCenterPage() {
  const nowMs = bucketNowMs()
  return <QcCommandSection nowMs={nowMs} />
}
