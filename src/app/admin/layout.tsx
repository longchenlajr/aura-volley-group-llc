import { AdminShell } from "./AdminShell";
import "./admin.css";

export const metadata = {
  title: { default: "Admin", template: "%s | Admin" },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
