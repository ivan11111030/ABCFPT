"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/lib/firebase";

export default function HomePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/control");
      } else {
        router.replace("/auth");
      }
      setChecked(true);
    });
    return () => unsubscribe();
  }, [router]);

  if (!checked) {
    return null;
  }

  return null;
}
