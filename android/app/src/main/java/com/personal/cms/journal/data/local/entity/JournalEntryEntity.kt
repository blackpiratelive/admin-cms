package com.personal.cms.journal.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "journal_entries")
data class JournalEntryEntity(
    @PrimaryKey val id: String,
    val slug: String,
    val entryDate: String, // YYYY-MM-DD
    val entryType: String = "daily",
    val mood: String? = null,
    val favorite: Int = 0,
    val visibility: String = "private",
    val locationId: String? = null,
    val tripId: String? = null,
    val weatherId: String? = null,
    val encryptedContent: String,
    val encryptionVersion: Int = 1,
    val iv: String,
    val salt: String,
    val wordCount: Int = 0,
    val readingTime: Int = 0,
    val tagsJson: String = "[]",
    val createdAt: String,
    val updatedAt: String,
    val isSynced: Boolean = false,
    val isDeleted: Boolean = false
)
