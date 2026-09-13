import { NextResponse } from "next/server";
import { getCloudinaryResources } from "@/features/media/cloudinaryActions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getCloudinaryResources();
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch Cloudinary resources" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      resources: result.resources || [],
    });
  } catch (error: any) {
    console.error("Cloudinary resources API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
