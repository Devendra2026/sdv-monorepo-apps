"use client";

import { useCallback, useEffect } from "react";

const PRINT_MODE_CLASS = "demand-register-print-mode";

/** Hides dashboard chrome and shows only the register block when printing. */
export function useDemandRegisterPrint() {
  useEffect(() => {
    const onBeforePrint = () => {
      document.documentElement.classList.add(PRINT_MODE_CLASS);
    };
    const onAfterPrint = () => {
      document.documentElement.classList.remove(PRINT_MODE_CLASS);
    };

    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      document.documentElement.classList.remove(PRINT_MODE_CLASS);
    };
  }, []);

  const printRegister = useCallback(() => {
    document.documentElement.classList.add(PRINT_MODE_CLASS);
    requestAnimationFrame(() => window.print());
  }, []);

  return { printRegister };
}
