import { getMicroblogs } from "@/features/microblog/actions";
import { MicroblogList } from "@/features/microblog/MicroblogList";

export const dynamic = "force-dynamic";

export default async function MicroblogListPage() {
  const posts = await getMicroblogs();
  return <MicroblogList initialItems={posts} />;
}
