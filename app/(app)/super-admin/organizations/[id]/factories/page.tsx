import { OrganizationFactoriesPage } from "@/features/super-admin/super-admin";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrganizationFactoriesPage organizationId={id}/>;
}
