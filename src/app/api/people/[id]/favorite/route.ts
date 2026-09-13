import { NextResponse } from "next/server";
import { toggleFavoritePersonAction, getPersonByIdOrSlugAction } from "@/features/people/actions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await toggleFavoritePersonAction(id);

    if (!success) {
      return NextResponse.json({ error: "Person not found or failed to toggle favorite" }, { status: 404 });
    }

    const updated = await getPersonByIdOrSlugAction(id);

    return NextResponse.json({
      success: true,
      favorite: updated ? updated.favorite === 1 : false,
    });
  } catch (error: any) {
    console.error("Failed to toggle person favorite:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
