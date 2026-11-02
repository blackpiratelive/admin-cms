import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/features/auth/session";
import { getUsersListAction } from "@/features/auth/users-actions";
import { UserAccountsManager } from "./UserAccountsManager";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "User Accounts | Settings",
  description: "Create and manage user accounts and access credentials.",
};

export default async function UserAccountsPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "superadmin") {
    redirect("/");
  }

  const users = await getUsersListAction();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Link
          href="/settings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "13px",
            color: "var(--text-secondary)",
            textDecoration: "none",
          }}
        >
          <ChevronLeft size={16} />
          <span>Back to Settings</span>
        </Link>
      </div>

      <div className="page-header" style={{ marginBottom: "8px" }}>
        <div>
          <h1 className="page-title">User Accounts & Access</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Create and manage access credentials. Newly created accounts start with zero module permissions.
          </p>
        </div>
      </div>

      <UserAccountsManager initialUsers={users} />
    </div>
  );
}
