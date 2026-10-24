import BoardsPage from "@/features/visual-management/boards-page";
import DailyManagementOverviewPage from "@/features/visual-management/daily-management-overview-page";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return tab === "overview" ? <DailyManagementOverviewPage /> : <BoardsPage />;
}
