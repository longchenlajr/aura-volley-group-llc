import { AdminShell } from "./AdminShell";
import "./admin.css";

export const metadata = {
  title: { default: "Admin | Long Volleyball", template: "%s | Admin | Long Volleyball" },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
