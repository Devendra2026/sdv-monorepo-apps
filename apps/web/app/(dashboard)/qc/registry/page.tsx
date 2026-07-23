import { QcRegistrySection } from "@/app/(dashboard)/qc/registry/qc-registry-section"
import { bucketNowMs } from "@/lib/now-ms"

export default function QcRegistryPage() {
  const nowMs = bucketNowMs()
  return <QcRegistrySection nowMs={nowMs} />
}
