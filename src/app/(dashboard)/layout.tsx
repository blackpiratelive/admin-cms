import { getSessionUser } from "@/features/auth/session";
import { DashboardClientShell } from "./DashboardClientShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <DashboardClientShell user={user}>
      {children}
    </DashboardClientShell>
  );
}
