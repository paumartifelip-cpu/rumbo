"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileNav, Sidebar } from "@/components/Sidebar";
import { useRumbo } from "@/lib/store";
import { getCurrentProfileId } from "@/lib/profiles";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile } = useRumbo();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Wait until store has hydrated. profile === null after mount and no
    // saved id means redirect to login.
    const id = getCurrentProfileId();
    if (!id) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
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
