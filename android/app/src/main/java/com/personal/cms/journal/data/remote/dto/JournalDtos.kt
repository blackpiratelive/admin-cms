package com.personal.cms.journal.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val password: String
)

@Serializable
data class LoginResponse(
    val success: Boolean = false,
    val token: String? = null,
    val error: String? = null,
    val message: String? = null
)

@Serializable
data class StatusResponse(
    val status: String,
    val app: String,
    val module: String,
    val version: String,
    val timestamp: String? = null
)

@Serializable
data class KeyRecordDto(
    val id: String = "default",
    val encryptedDek: String,
    val salt: String,
    val iv: String,
    val algorithm: String = "AES-256-GCM",
    val kdf: String = "Argon2id",
    val argonMemory: Int = 65536,
    val argonIterations: Int = 3,
    val argonParallelism: Int = 1,
    val keyVersion: Int = 1
)

@Serializable
data class KeysResponse(
    val keys: KeyRecordDto? = null,
    val error: String? = null
)

@Serializable
data class SettingsRecordDto(
    val id: String = "default",
    val salt: String,
    val verificationPayload: String,
    val verificationIv: String,
    val autoLockMinutes: Int = 15
)

@Serializable
data class SettingsResponse(
    val settings: SettingsRecordDto? = null,
    val error: String? = null
)

@Serializable
data class EntryDto(
    val id: String? = null,
    val slug: String? = null,
    val entryDate: String,
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
    val tags: String? = "[]",
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class EntriesResponse(
    val entries: List<EntryDto> = emptyList(),
    val error: String? = null
)

@Serializable
data class SingleEntryResponse(
    val entry: EntryDto? = null,
    val error: String? = null
)

@Serializable
data class SyncPayloadItem(
    val id: String? = null,
    val operation: String,
    val payload: EntryDto? = null
)

@Serializable
data class SyncRequest(
    val items: List<SyncPayloadItem>,
    val lastSyncedAt: String? = null
)

@Serializable
data class SyncResultItem(
    val id: String? = null,
    val status: String,
    val error: String? = null
)

@Serializable
data class SyncResponse(
    val processed: List<SyncResultItem> = emptyList(),
    val serverEntries: List<EntryDto> = emptyList(),
    val syncedAt: String? = null,
    val error: String? = null
)
