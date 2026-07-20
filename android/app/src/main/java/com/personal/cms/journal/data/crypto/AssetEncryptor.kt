package com.personal.cms.journal.data.crypto

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.File
import javax.crypto.SecretKey

data class ProcessedAssetResult(
    val width: Int,
    val height: Int,
    val originalSize: Int,
    val compressedSize: Int,
    val thumbnailSize: Int,
    val encryptedOriginalBytes: ByteArray,
    val encryptedThumbnailBytes: ByteArray,
    val originalIvBase64: String,
    val thumbnailIvBase64: String
)

object AssetEncryptor {

    fun processAndEncryptImage(
        context: Context,
        imageUri: Uri,
        dekKey: SecretKey
    ): ProcessedAssetResult {
        val inputStream = context.contentResolver.openInputStream(imageUri)
            ?: throw IllegalArgumentException("Cannot open image stream")
        val rawBytes = inputStream.readBytes()
        inputStream.close()

        val originalSize = rawBytes.size

        // Decode bitmap (stripping EXIF metadata when re-encoded)
        val bitmap = BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size)
            ?: throw IllegalArgumentException("Failed to decode image bitmap")

        val width = bitmap.width
        val height = bitmap.height

        // Compress main image (JPEG 90%)
        val mainStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 90, mainStream)
        val compressedBytes = mainStream.toByteArray()

        // Generate thumbnail (max 512px)
        val maxDim = 512
        val scale = Math.min(maxDim.toFloat() / width, maxDim.toFloat() / height)
        val thumbWidth = (width * scale).toInt().coerceAtLeast(1)
        val thumbHeight = (height * scale).toInt().coerceAtLeast(1)
        val thumbBitmap = Bitmap.createScaledBitmap(bitmap, thumbWidth, thumbHeight, true)

        val thumbStream = ByteArrayOutputStream()
        thumbBitmap.compress(Bitmap.CompressFormat.JPEG, 85, thumbStream)
        val thumbnailBytes = thumbStream.toByteArray()

        // Encrypt main image with DEK
        val (encMain, mainIv) = CryptoEngine.encryptBytes(compressedBytes, dekKey)
        // Encrypt thumbnail with DEK
        val (encThumb, thumbIv) = CryptoEngine.encryptBytes(thumbnailBytes, dekKey)

        return ProcessedAssetResult(
            width = width,
            height = height,
            originalSize = originalSize,
            compressedSize = compressedBytes.size,
            thumbnailSize = thumbnailBytes.size,
            encryptedOriginalBytes = encMain,
            encryptedThumbnailBytes = encThumb,
            originalIvBase64 = Base64.encodeToString(mainIv, Base64.NO_WRAP),
            thumbnailIvBase64 = Base64.encodeToString(thumbIv, Base64.NO_WRAP)
        )
    }

    fun saveEncryptedAssetToFile(context: Context, assetId: String, suffix: String, bytes: ByteArray): File {
        val dir = File(context.filesDir, "encrypted_assets")
        if (!dir.exists()) dir.mkdirs()
        val file = File(dir, "${assetId}_${suffix}.enc")
        file.writeBytes(bytes)
        return file
    }
}
