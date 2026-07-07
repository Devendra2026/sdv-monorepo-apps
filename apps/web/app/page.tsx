import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Home",
}

export default async function Home() {
  const { isAuthenticated } = await auth()
  redirect(isAuthenticated ? "/dashboard" : "/sign-in")
}
