import { redirect } from "next/navigation";
import { brandvilleInstance } from "@/brandville/config";

export default function DocsIndexPage() {
  redirect(`/docs/${brandvilleInstance.navigation.defaultDocSlug}`);
}
