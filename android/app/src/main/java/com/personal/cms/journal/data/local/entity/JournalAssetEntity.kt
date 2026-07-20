package com.personal.cms.journal.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "journal_assets")
data class JournalAssetEntity(
    @PrimaryKey val id: String,
    val entryId: String? = null,
    val assetType: String = "image",
    val mimeType: String = "image/jpeg",
    val width: Int = 0,
    val height: Int = 0,
    val originalSize: Int = 0,
    val compressedSize: Int = 0,
    val thumbnailSize: Int = 0,
    val cloudinaryOriginalPublicId: String = "",
    val cloudinaryThumbnailPublicId: String = "",
    val originalIv: String,
    val thumbnailIv: String,
    val encryptionVersion: Int = 1,
    val localThumbPath: String? = null,
    val localOriginalPath: String? = null,
    val createdAt: String,
    val updatedAt: String,
    val isSynced: Boolean = false
)
