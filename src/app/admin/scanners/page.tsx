import { redirect } from "next/navigation";

export default function AdminScannersRedirect() {
  redirect("/admin/accounts?kind=scanner");
}
