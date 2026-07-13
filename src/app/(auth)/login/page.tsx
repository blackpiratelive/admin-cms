import { LoginForm } from "@/features/auth/LoginForm";

export const metadata = {
  title: "Login | Personal CMS",
  description: "Sign in to Personal CMS for Hugo + Turso",
};

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <LoginForm />
    </div>
  );
}
