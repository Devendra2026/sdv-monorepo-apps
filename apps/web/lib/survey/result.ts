/** Typed result for survey lib helpers that touch browser APIs or file I/O. */
export type SurveyLibResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string }

export function surveyLibOk<T>(data: T): SurveyLibResult<T> {
  return { ok: true, data }
}

export function surveyLibErr<T>(code: string, message: string): SurveyLibResult<T> {
  return { ok: false, code, message }
}
