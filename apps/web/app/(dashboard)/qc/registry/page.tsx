import { QcRegistrySection } from "@/app/(dashboard)/qc/registry/qc-registry-section"

export default function QcRegistryPage() {
  const nowMs = Date.now()
  return <QcRegistrySection nowMs={nowMs} />
}
