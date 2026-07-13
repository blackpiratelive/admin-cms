import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-container">
      <Header />
      <div className="body-layout">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
