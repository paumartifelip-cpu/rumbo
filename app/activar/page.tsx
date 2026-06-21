"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy Stripe-activation route. Sign-up is now free with email + password,
// so this page just forwards to the login screen.
export default function ActivarPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-rumbo-muted text-sm">
      Redirigiendo…
    </div>
  );
}
