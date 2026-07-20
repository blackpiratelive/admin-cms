package com.personal.cms.journal.ui.journal

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.personal.cms.journal.data.repository.JournalRepository
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun JournalTimelineScreen(
    journalRepository: JournalRepository,
    onOpenEntry: (String) -> Unit
) {
    val entriesState by journalRepository.getEntriesFlow().collectAsState(initial = emptyList())

    val groupedEntries = remember(entriesState) {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, -1)
        val yesterdayStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)

        val groups = mutableMapOf<String, MutableList<com.personal.cms.journal.data.local.entity.JournalEntryEntity>>()

        for (entry in entriesState) {
            val groupKey = when (entry.entryDate) {
                todayStr -> "Today"
                yesterdayStr -> "Yesterday"
                else -> {
                    val dateYearMonth = if (entry.entryDate.length >= 7) entry.entryDate.substring(0, 7) else "Older"
                    "Month $dateYearMonth"
                }
            }
            groups.getOrPut(groupKey) { mutableListOf() }.add(entry)
        }
        groups
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        groupedEntries.forEach { (header, list) ->
            item {
                Text(
                    text = header,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            items(list) { entry ->
                EntryCardItem(entry = entry, onClick = { onOpenEntry(entry.id) }, journalRepository = journalRepository)
            }
        }
    }
}
