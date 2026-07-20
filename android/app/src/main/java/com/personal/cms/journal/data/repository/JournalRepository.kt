package com.personal.cms.journal.data.repository

import android.content.Context
import com.personal.cms.journal.data.crypto.CryptoEngine
import com.personal.cms.journal.data.crypto.KeystoreManager
import com.personal.cms.journal.data.local.JournalDatabase
import com.personal.cms.journal.data.local.entity.JournalEntryEntity
import com.personal.cms.journal.data.local.entity.SyncQueueEntity
import com.personal.cms.journal.data.remote.JournalApiService
import com.personal.cms.journal.data.remote.dto.EntryDto
import com.personal.cms.journal.data.remote.dto.SyncPayloadItem
import com.personal.cms.journal.data.remote.dto.SyncRequest
import com.personal.cms.journal.domain.usecase.LexicalParser
import kotlinx.coroutines.flow.Flow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class JournalRepository(
    private val context: Context
) {

    private val db = JournalDatabase.getInstance(context)
    private val keystoreManager = KeystoreManager(context)
    private val apiService = JournalApiService()

    fun getEntriesFlow(): Flow<List<JournalEntryEntity>> {
        return db.journalEntryDao().getAllEntriesFlow()
    }

    suspend fun getEntryById(id: String): JournalEntryEntity? {
        return db.journalEntryDao().getEntryById(id)
    }

    suspend fun decryptEntryContent(entry: JournalEntryEntity): String {
        val dek = keystoreManager.activeDEK ?: throw IllegalStateException("Journal is locked")
        return try {
            CryptoEngine.decryptText(entry.encryptedContent, entry.iv, dek)
        } catch (e: Exception) {
            "Error: Decryption failed."
        }
    }

    suspend fun saveJournalEntry(
        entryDate: String,
        contentLexicalJson: String,
        entryType: String = "daily",
        mood: String? = null,
        favorite: Int = 0,
        visibility: String = "private",
        locationId: String? = null,
        tripId: String? = null,
        existingId: String? = null
    ): JournalEntryEntity {
        val dek = keystoreManager.activeDEK ?: throw IllegalStateException("Journal is locked")

        val doc = LexicalParser.parseLexicalJson(contentLexicalJson)
        val plaintext = LexicalParser.extractPlaintext(doc)
        val wordCount = LexicalParser.calculateWordCount(plaintext)
        val readingTime = LexicalParser.calculateReadingTime(wordCount)

        val (encryptedContent, iv) = CryptoEngine.encryptText(contentLexicalJson, dek)
        val salt = CryptoEngine.generateSalt()
        val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())

        val id = existingId ?: "jnl_${System.currentTimeMillis()}_${UUID.randomUUID().toString().substring(0, 5)}"
        val slug = "journal-$entryDate-${UUID.randomUUID().toString().substring(0, 5)}"

        val entity = JournalEntryEntity(
            id = id,
            slug = slug,
            entryDate = entryDate,
            entryType = entryType,
            mood = mood,
            favorite = favorite,
            visibility = visibility,
            locationId = locationId,
            tripId = tripId,
            encryptedContent = encryptedContent,
            encryptionVersion = 1,
            iv = iv,
            salt = salt,
            wordCount = wordCount,
            readingTime = readingTime,
            createdAt = now,
            updatedAt = now,
            isSynced = false,
            isDeleted = false
        )

        db.journalEntryDao().insertOrUpdate(entity)

        val operation = if (existingId != null) "UPDATE" else "CREATE"
        db.syncQueueDao().enqueue(
            SyncQueueEntity(
                id = "sq_${System.currentTimeMillis()}_${UUID.randomUUID().toString().substring(0, 4)}",
                entityType = "entry",
                entityId = id,
                operation = operation,
                payloadJson = "",
                createdAt = now
            )
        )

        return entity
    }

    suspend fun deleteEntry(id: String) {
        val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())
        db.journalEntryDao().softDeleteEntry(id, now)

        db.syncQueueDao().enqueue(
            SyncQueueEntity(
                id = "sq_${System.currentTimeMillis()}_${UUID.randomUUID().toString().substring(0, 4)}",
                entityType = "entry",
                entityId = id,
                operation = "DELETE",
                payloadJson = "",
                createdAt = now
            )
        )
    }

    suspend fun searchLocalEntries(query: String): List<Pair<JournalEntryEntity, String>> {
        val dek = keystoreManager.activeDEK ?: return emptyList()
        val all = db.journalEntryDao().getAllEntries()
        val results = mutableListOf<Pair<JournalEntryEntity, String>>()

        val qLower = query.lowercase().trim()
        if (qLower.isBlank()) return emptyList()

        for (entry in all) {
            try {
                val jsonStr = CryptoEngine.decryptText(entry.encryptedContent, entry.iv, dek)
                val plaintext = LexicalParser.extractPlaintext(LexicalParser.parseLexicalJson(jsonStr))
                if (plaintext.lowercase().contains(qLower) || entry.entryDate.contains(qLower)) {
                    results.add(Pair(entry, plaintext))
                }
            } catch (e: Exception) {
                // Ignore failed decryption
            }
        }
        return results
    }

    suspend fun syncWithServer(): Boolean {
        val baseUrl = keystoreManager.getBaseUrl() ?: return false
        val token = keystoreManager.getAuthToken() ?: return false

        return try {
            val queueItems = db.syncQueueDao().getAllQueueItems()

            val syncPayloadItems = queueItems.mapNotNull { item ->
                if (item.entityType == "entry") {
                    val entryEntity = db.journalEntryDao().getEntryById(item.entityId)
                    val entryDto = if (entryEntity != null && item.operation != "DELETE") {
                        EntryDto(
                            id = entryEntity.id,
                            slug = entryEntity.slug,
                            entryDate = entryEntity.entryDate,
                            entryType = entryEntity.entryType,
                            mood = entryEntity.mood,
                            favorite = entryEntity.favorite,
                            visibility = entryEntity.visibility,
                            locationId = entryEntity.locationId,
                            tripId = entryEntity.tripId,
                            encryptedContent = entryEntity.encryptedContent,
                            iv = entryEntity.iv,
                            salt = entryEntity.salt,
                            wordCount = entryEntity.wordCount,
                            readingTime = entryEntity.readingTime,
                            createdAt = entryEntity.createdAt,
                            updatedAt = entryEntity.updatedAt
                        )
                    } else null

                    SyncPayloadItem(
                        id = item.entityId,
                        operation = item.operation,
                        payload = entryDto
                    )
                } else null
            }

            val response = apiService.batchSync(
                baseUrl,
                token,
                SyncRequest(items = syncPayloadItems)
            )

            // Dequeue successful items
            response.processed.forEach { res ->
                if (res.status == "success" && res.id != null) {
                    val qItem = queueItems.find { it.entityId == res.id }
                    qItem?.let { db.syncQueueDao().dequeue(it.id) }
                }
            }

            val fetchedEntries = if (response.serverEntries.isNotEmpty()) {
                response.serverEntries
            } else {
                try {
                    apiService.fetchEntries(baseUrl, token).entries
                } catch (e: Exception) {
                    emptyList()
                }
            }

            // Save incoming server entries
            val remoteEntities = fetchedEntries.map { dto ->
                JournalEntryEntity(
                    id = dto.id ?: "jnl_${System.currentTimeMillis()}",
                    slug = dto.slug ?: "journal-${dto.entryDate}",
                    entryDate = dto.entryDate,
                    entryType = dto.entryType,
                    mood = dto.mood,
                    favorite = dto.favorite,
                    visibility = dto.visibility,
                    locationId = dto.locationId,
                    tripId = dto.tripId,
                    weatherId = dto.weatherId,
                    encryptedContent = dto.encryptedContent,
                    encryptionVersion = dto.encryptionVersion,
                    iv = dto.iv,
                    salt = dto.salt,
                    wordCount = dto.wordCount,
                    readingTime = dto.readingTime,
                    tagsJson = dto.tags ?: "[]",
                    createdAt = dto.createdAt ?: "",
                    updatedAt = dto.updatedAt ?: "",
                    isSynced = true,
                    isDeleted = false
                )
            }

            if (remoteEntities.isNotEmpty()) {
                db.journalEntryDao().insertAll(remoteEntities)
            }

            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
