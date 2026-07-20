package com.personal.cms.journal.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.personal.cms.journal.data.local.entity.JournalEntryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface JournalEntryDao {

    @Query("SELECT * FROM journal_entries WHERE isDeleted = 0 ORDER BY entryDate DESC, createdAt DESC")
    fun getAllEntriesFlow(): Flow<List<JournalEntryEntity>>

    @Query("SELECT * FROM journal_entries WHERE isDeleted = 0 ORDER BY entryDate DESC, createdAt DESC")
    suspend fun getAllEntries(): List<JournalEntryEntity>

    @Query("SELECT * FROM journal_entries WHERE id = :id AND isDeleted = 0 LIMIT 1")
    suspend fun getEntryById(id: String): JournalEntryEntity?

    @Query("SELECT * FROM journal_entries WHERE slug = :slug AND isDeleted = 0 LIMIT 1")
    suspend fun getEntryBySlug(slug: String): JournalEntryEntity?

    @Query("SELECT * FROM journal_entries WHERE entryDate = :dateStr AND isDeleted = 0 LIMIT 1")
    suspend fun getEntryByDate(dateStr: String): JournalEntryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(entry: JournalEntryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<JournalEntryEntity>)

    @Query("UPDATE journal_entries SET isDeleted = 1, isSynced = 0, updatedAt = :updatedAt WHERE id = :id")
    suspend fun softDeleteEntry(id: String, updatedAt: String)

    @Query("DELETE FROM journal_entries WHERE id = :id")
    suspend fun hardDeleteEntry(id: String)
}
