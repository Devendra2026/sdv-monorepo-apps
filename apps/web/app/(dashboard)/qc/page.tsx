import { QcCommandSection } from "@/app/(dashboard)/qc/qc-command-section"

export default function QcCommandCenterPage() {
  const nowMs = Date.now()
  return <QcCommandSection nowMs={nowMs} />
}
