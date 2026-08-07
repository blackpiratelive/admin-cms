import { NextResponse } from "next/server";
import { uploadRawDirectToCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;
    const fileName = (formData.get("fileName") as string) || `enc_asset_${Date.now()}.enc`;

    if (!file) {
      return NextResponse.json({ error: "No blob provided in form data" }, { status: 400 });
    }

    const result = await uploadRawDirectToCloudinary(file, fileName);
    return NextResponse.json({
      secure_url: result.secure_url,
      public_id: result.public_id,
      bytes: result.bytes,
    });
  } catch (error: any) {
    console.error("Raw encrypted asset upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload raw asset" }, { status: 500 });
  }
}
