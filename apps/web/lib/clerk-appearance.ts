/** SDV Premium branding for Clerk sign-in / sign-up components. */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#002366",
    colorDanger: "#CC0000",
    colorSuccess: "#16a34a",
    colorWarning: "#d97706",
    borderRadius: "0.875rem",
    fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
  },
  elements: {
    card: "shadow-none bg-transparent border-0 p-0",
    headerTitle: "font-display text-xl font-semibold text-foreground",
    headerSubtitle: "text-muted-foreground text-sm",
    formButtonPrimary:
      "bg-[#002366] hover:bg-[#001a4d] text-white font-semibold shadow-premium-sm transition-colors",
    footerActionLink: "text-[#002366] hover:text-[#001a4d] font-medium",
    formFieldInput: "rounded-xl border-border bg-background",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground text-xs",
  },
};
