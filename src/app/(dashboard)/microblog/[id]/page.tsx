import { getMicroblogById, fetchRelatedPosts } from "@/features/microblog/actions";
import { MicroblogEditor } from "@/features/microblog/MicroblogEditor";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditMicroblogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getMicroblogById(id);

  if (!post) {
    notFound();
  }

  const related = await fetchRelatedPosts(id);

  return <MicroblogEditor initialData={post} initialRelatedPosts={related} />;
}
