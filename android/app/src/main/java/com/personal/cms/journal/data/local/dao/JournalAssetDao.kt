package com.personal.cms.journal.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.personal.cms.journal.data.local.entity.JournalAssetEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface JournalAssetDao {

    @Query("SELECT * FROM journal_assets WHERE entryId = :entryId")
    fun getAssetsForEntryFlow(entryId: String): Flow<List<JournalAssetEntity>>

    @Query("SELECT * FROM journal_assets WHERE entryId = :entryId")
    suspend fun getAssetsForEntry(entryId: String): List<JournalAssetEntity>

    @Query("SELECT * FROM journal_assets WHERE id = :id LIMIT 1")
    suspend fun getAssetById(id: String): JournalAssetEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(asset: JournalAssetEntity)

    @Query("DELETE FROM journal_assets WHERE id = :id")
    suspend fun deleteAsset(id: String)
}
