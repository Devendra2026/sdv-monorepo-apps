"use client"

import { PageTransition } from "@/components/design-system/motion"
import { RoleGate } from "@/components/shared/role-gate"
import { SurveyPageDetailView } from "@/components/surveys/survey-detail-view"
import { SurveyViewHero } from "@/components/surveys/survey-view-hero"
import { useQcRemarks } from "@/hooks/qc/useQc"
import { usePreloadedSurvey, useRemoveSurvey, useSurvey } from "@/hooks/surveys/useSurveys"
import { canUserEditSurvey } from "@/lib/domain"
import { parseConvexError } from "@/lib/errors"
import { useCurrentUser } from "@/lib/sessions"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import type { Preloaded } from "convex/react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

function SurveyDetailView({ id, survey }: { id: string; survey: ReturnType<typeof useSurvey> }) {
  const router = useRouter()
  const remarks = useQcRemarks(id)
  const removeSurvey = useRemoveSurvey()
  const { role, capabilities } = useCurrentUser()
  const canEdit = survey ? canUserEditSurvey(survey, { role, capabilities }) : false
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (survey === undefined) {
    return (
      <PageTransition className="space-y-6">
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-5">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </PageTransition>
    )
  }

  if (survey === null) {
    notFound()
  }

  async function onDeleteConfirm() {
    setDeleting(true)
    try {
      await removeSurvey({ id: id as Id<"surveys"> })
      toast.success("Survey deleted")
      router.push("/surveys")
    } catch (e) {
      toast.error(parseConvexError(e).message)
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <PageTransition className="space-y-6 lg:space-y-8">
      <Button
        asChild
        variant="outline"
        size="sm"
        className="w-fit cursor-pointer rounded-xl border-border/70 bg-card/80 px-4 shadow-premium-sm backdrop-blur-sm transition-colors duration-200 hover:bg-muted/40"
      >
        <Link href="/surveys">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to surveys
        </Link>
      </Button>

      <SurveyViewHero survey={survey} surveyId={id} canEdit={canEdit} showStatus onDelete={() => setDeleteOpen(true)} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this survey?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the survey and its photos. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void onDeleteConfirm()
              }}
            >
              {deleting ? "Deleting…" : "Delete survey"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SurveyPageDetailView survey={survey} surveyId={id} remarks={remarks} />
    </PageTransition>
  )
}

function SurveyDetailWithPreload({
  id,
  preloadedSurvey,
}: {
  id: string
  preloadedSurvey: Preloaded<typeof api.surveys.queries.get>
}) {
  const survey = usePreloadedSurvey(preloadedSurvey)
  return <SurveyDetailView id={id} survey={survey} />
}

function SurveyDetailWithQuery({ id }: { id: string }) {
  const survey = useSurvey(id)
  return <SurveyDetailView id={id} survey={survey} />
}

export function SurveyDetailClient({
  id,
  preloadedSurvey,
}: {
  id: string
  preloadedSurvey: Preloaded<typeof api.surveys.queries.get>
}) {
  return (
    <RoleGate
      mode="page"
      anyOf={["surveys.viewOwn", "surveys.viewAssigned", "surveys.viewAll", "qc.review"]}
      deniedDescription="You don't have permission to view survey records."
      redirectTo="/dashboard"
    >
      <SurveyDetailWithPreload id={id} preloadedSurvey={preloadedSurvey} />
    </RoleGate>
  )
}

export function SurveyDetailFallback({ id }: { id: string }) {
  return (
    <RoleGate
      mode="page"
      anyOf={["surveys.viewOwn", "surveys.viewAssigned", "surveys.viewAll", "qc.review"]}
      deniedDescription="You don't have permission to view survey records."
      redirectTo="/dashboard"
    >
      <SurveyDetailWithQuery id={id} />
    </RoleGate>
  )
}
