import { redirect } from "next/navigation";
import { brandvilleInstance, hasBrand } from "@/brandville/config";
import { EmptyBrandState } from "@/components/shell/EmptyBrandState";

export default function DocsIndexPage() {
  if (!hasBrand) {
    return <EmptyBrandState />;
  }
  redirect(`/docs/${brandvilleInstance.navigation.defaultDocSlug}`);
}
