/**
 * Owner-step dropdown constants — safe to import from the browser via `@/lib/domain`.
 * Keep this file free of `query` / `mutation` / `./_generated/server` imports.
 */

export const RESPONDENT_RELATIONSHIP_VALUES = [
  "self",
  "father",
  "mother",
  "wife",
  "son",
  "daughter",
  "brother",
  "sister",
  "neighbour",
  "other",
] as const;

export type RespondentRelationshipValue = (typeof RESPONDENT_RELATIONSHIP_VALUES)[number];

export const RESPONDENT_RELATIONSHIPS: { value: RespondentRelationshipValue; label: string }[] = [
  { value: "self", label: "Self" },
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "wife", label: "Wife" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
  { value: "neighbour", label: "Neighbour" },
  { value: "other", label: "Other" },
];

export const MAX_SURVEY_OWNERS = 10;
