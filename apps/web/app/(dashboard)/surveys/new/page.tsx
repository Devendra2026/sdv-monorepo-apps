"use client"

import { ExecutiveHero } from "@/components/design-system/executive-hero"
import { FadeIn } from "@/components/design-system/motion"
import { RoleGate } from "@/components/shared/role-gate"
import { SurveyEditor } from "@/components/surveys/survey-editor"
import { Button } from "@workspace/ui/components/button"
import { ArrowLeft, ClipboardList } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Generates the idempotency key the mobile app would generate before sync. */
function newLocalId() {
  return `web_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export default function NewSurveyPage() {
  const router = useRouter()
  const [localId] = useState(newLocalId)
  const [surveyId, setSurveyId] = useState<string | undefined>()

  return (
    <RoleGate
      mode="page"
      capability="surveys.editDraft"
      deniedDescription="Only surveyors and administrators can create surveys."
    >
      <div className="space-y-6 lg:space-y-8">
        <FadeIn>
          <ExecutiveHero
            eyebrow="Survey Command Center"
            title="New Survey"
            description="Complete each tab — property details, area, photos and GPS — then submit for QC."
            icon={ClipboardList}
            gradient="brand"
            actions={
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-fit cursor-pointer rounded-xl border-indigo-300/60 bg-card/80 px-4 shadow-premium-sm backdrop-blur-sm hover:bg-indigo-500/10 dark:border-indigo-700/50"
              >
                <Link href="/surveys">
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back to surveys
                </Link>
              </Button>
            }
          />
        </FadeIn>

        <SurveyEditor
          localId={localId}
          surveyId={surveyId}
          onSaved={(id) => {
            setSurveyId(id)
            router.replace(`/surveys/${id}/edit`)
          }}
        />
      </div>
    </RoleGate>
  )
}
