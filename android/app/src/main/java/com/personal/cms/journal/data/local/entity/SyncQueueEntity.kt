package com.personal.cms.journal.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_queue")
data class SyncQueueEntity(
    @PrimaryKey val id: String,
    val entityType: String, // "entry" | "asset"
    val entityId: String,
    val operation: String, // "CREATE" | "UPDATE" | "DELETE"
    val payloadJson: String,
    val createdAt: String,
    val attempts: Int = 0
)
