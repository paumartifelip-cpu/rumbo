"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileNav, Sidebar } from "@/components/Sidebar";
import { useRumbo } from "@/lib/store";
import { getCurrentProfileId, setCurrentProfileId } from "@/lib/profiles";
import { needsPinPrompt } from "@/lib/pin";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile } = useRumbo();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Wait until store has hydrated. profile === null after mount and no
    // saved id means redirect to login. Also boot back to login if the PIN
    // hasn't been verified for a while.
    const id = getCurrentProfileId();
    if (!id) {
      router.replace("/login");
      return;
    }
    if (needsPinPrompt(id)) {
      // Drop the session so the login page doesn't bounce us back. Local
      // data buckets stay intact — the user re-enters via PIN.
      setCurrentProfileId(null);
      window.location.replace("/login");
      return;
    }
    setChecked(true);
  }, [router]);

  if (!checked || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rumbo-muted text-sm">
        Cargando…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 md:px-10 py-6 md:py-10 pb-24 md:pb-10 max-w-[1400px] w-full mx-auto">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
