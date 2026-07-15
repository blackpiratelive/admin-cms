import { getMicroblogs } from "@/features/microblog/actions";
import { MicroblogList } from "@/features/microblog/MicroblogList";

export const dynamic = "force-dynamic";

export default async function MicroblogListPage() {
  const initialData = await getMicroblogs({ page: 1, limit: 50 });
  return <MicroblogList initialData={initialData} />;
}
