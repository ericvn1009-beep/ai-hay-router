"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function Nav({ email }: { email?: string }) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="nav">
      <Link href="/keys" className="brand">
        AI Hay
      </Link>
      <Link href="/keys" className={path === "/keys" ? "active" : ""}>
        Keys
      </Link>
      <Link href="/usage" className={path === "/usage" ? "active" : ""}>
        Usage
      </Link>
      <Link href="/byok" className={path === "/byok" ? "active" : ""}>
        BYOK
      </Link>
      <Link href="/wallet" className={path === "/wallet" ? "active" : ""}>
        Wallet
      </Link>
      {email && <span className="muted mono">{email}</span>}
      <button type="button" className="secondary" onClick={() => void logout()}>
        Log out
      </button>
    </nav>
  );
}
