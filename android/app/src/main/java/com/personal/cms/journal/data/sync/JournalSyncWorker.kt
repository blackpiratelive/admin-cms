package com.personal.cms.journal.data.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.personal.cms.journal.data.crypto.KeystoreManager
import com.personal.cms.journal.data.local.JournalDatabase
import com.personal.cms.journal.data.remote.JournalApiService
import com.personal.cms.journal.data.remote.dto.EntryDto
import com.personal.cms.journal.data.remote.dto.SyncPayloadItem
import com.personal.cms.journal.data.remote.dto.SyncRequest

class JournalSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    private val db = JournalDatabase.getInstance(context)
    private val keystoreManager = KeystoreManager(context)
    private val apiService = JournalApiService()

    override suspend fun doWork(): Result {
        val baseUrl = keystoreManager.getBaseUrl() ?: return Result.success()
        val token = keystoreManager.getAuthToken() ?: return Result.success()

        return try {
            val queueItems = db.syncQueueDao().getAllQueueItems()

            val syncPayloadItems = queueItems.mapNotNull { item ->
                if (item.entityType == "entry") {
                    val entryEntity = db.journalEntryDao().getEntryById(item.entityId)
                    val entryDto = if (entryEntity != null) {
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
                            weatherId = entryEntity.weatherId,
                            encryptedContent = entryEntity.encryptedContent,
                            encryptionVersion = entryEntity.encryptionVersion,
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

            if (syncPayloadItems.isNotEmpty()) {
                val response = apiService.batchSync(
                    baseUrl,
                    token,
                    SyncRequest(items = syncPayloadItems)
                )

                response.processed.forEach { res ->
                    if (res.status == "success" && res.id != null) {
                        val queueItem = queueItems.find { it.entityId == res.id }
                        queueItem?.let { db.syncQueueDao().dequeue(it.id) }
                    }
                }
            }

            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }
}
