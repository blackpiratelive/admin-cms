import { getMicroblogById } from "@/features/microblog/actions";
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

  return <MicroblogEditor initialData={post} />;
}
