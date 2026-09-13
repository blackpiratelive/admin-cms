import { NextResponse } from "next/server";
import {
  getPeopleAction,
  createPersonAction,
  updatePersonAction,
  PeopleFilterOptions,
} from "@/features/people/actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const relationshipType = searchParams.get("relationshipType") || undefined;
    const favoriteParam = searchParams.get("favorite");
    const favorite = favoriteParam !== null ? favoriteParam === "true" || favoriteParam === "1" : undefined;
    const birthdayMonthParam = searchParams.get("birthdayMonth");
    const birthdayMonth = birthdayMonthParam ? parseInt(birthdayMonthParam, 10) : undefined;
    const visibility = (searchParams.get("visibility") as any) || undefined;
    const sortBy = (searchParams.get("sortBy") as any) || undefined;

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const filterOptions: PeopleFilterOptions = {
      search,
      relationshipType,
      favorite,
      birthdayMonth,
      visibility,
      sortBy,
    };

    const allPeople = await getPeopleAction(filterOptions);
    const total = allPeople.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paginatedPeople = allPeople.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      people: paginatedPeople,
      total,
      page,
      totalPages,
    });
  } catch (error: any) {
    console.error("Failed to fetch people:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.id) {
      const result = await updatePersonAction(body.id, body);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to update person" }, { status: 400 });
      }
      return NextResponse.json(result, { status: 200 });
    } else {
      const result = await createPersonAction(body);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to create person" }, { status: 400 });
      }
      return NextResponse.json(result, { status: 201 });
    }
  } catch (error: any) {
    console.error("Failed to save person:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save person" },
      { status: 400 }
    );
  }
}
