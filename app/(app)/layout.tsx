"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader, MobileNav, Sidebar } from "@/components/Sidebar";
import { useRumbo } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile } = useRumbo();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supa = getSupabase();
    if (!supa) {
      router.replace("/login");
      return;
    }
    let active = true;
    // Only an authenticated Supabase session may enter the app.
    supa.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setChecked(true);
    });
    // Bounce straight back to login the moment the session ends anywhere.
    const { data: sub } = supa.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!checked || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rumbo-muted text-sm">
        Cargando…
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <MobileHeader />
        <main className="flex-1 px-4 md:px-10 py-6 md:py-10 pb-24 md:pb-10 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
