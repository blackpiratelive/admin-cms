package com.personal.cms.journal.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.personal.cms.journal.data.local.dao.JournalAssetDao
import com.personal.cms.journal.data.local.dao.JournalEntryDao
import com.personal.cms.journal.data.local.dao.SyncQueueDao
import com.personal.cms.journal.data.local.entity.JournalAssetEntity
import com.personal.cms.journal.data.local.entity.JournalEntryEntity
import com.personal.cms.journal.data.local.entity.SyncQueueEntity

@Database(
    entities = [
        JournalEntryEntity::class,
        JournalAssetEntity::class,
        SyncQueueEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class JournalDatabase : RoomDatabase() {

    abstract fun journalEntryDao(): JournalEntryDao
    abstract fun journalAssetDao(): JournalAssetDao
    abstract fun syncQueueDao(): SyncQueueDao

    companion object {
        @Volatile
        private var INSTANCE: JournalDatabase? = null

        fun getInstance(context: Context): JournalDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    JournalDatabase::class.java,
                    "journal_offline.db"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
