import { clerkAppearance } from "@/lib/clerk-appearance"
import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return <SignUp appearance={clerkAppearance} signInUrl="/sign-in" />
}
