package com.personal.cms.journal.ui.journal

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.personal.cms.journal.data.local.entity.JournalEntryEntity
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
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val todayStr = sdf.format(Date())
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, -1)
        val yesterdayStr = sdf.format(cal.time)

        // Calculate start of this week (Sunday)
        val weekCal = Calendar.getInstance()
        weekCal.set(Calendar.DAY_OF_WEEK, weekCal.firstDayOfWeek)
        val weekStartStr = sdf.format(weekCal.time)

        val groups = linkedMapOf<String, MutableList<JournalEntryEntity>>()

        for (entry in entriesState) {
            val groupKey = when {
                entry.entryDate == todayStr -> "Today"
                entry.entryDate == yesterdayStr -> "Yesterday"
                entry.entryDate >= weekStartStr && entry.entryDate < todayStr -> "This Week"
                entry.entryDate.length >= 7 -> {
                    try {
                        val monthDate = SimpleDateFormat("yyyy-MM", Locale.US).parse(entry.entryDate.substring(0, 7))
                        SimpleDateFormat("MMMM yyyy", Locale.US).format(monthDate!!)
                    } catch (e: Exception) {
                        entry.entryDate.substring(0, 7)
                    }
                }
                else -> "Older"
            }
            groups.getOrPut(groupKey) { mutableListOf() }.add(entry)
        }
        groups
    }

    if (entriesState.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.Timeline,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    "No entries yet",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "Your journal timeline will appear here",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        // Header
        item {
            Text(
                text = "Timeline",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }

        groupedEntries.forEach { (header, list) ->
            // Group header with date badge
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Timeline dot for header
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary)
                    )
                    Spacer(modifier = Modifier.width(12.dp))

                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = header,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "${list.size} ${if (list.size == 1) "entry" else "entries"}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Entry items with timeline line
            items(list) { entry ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top
                ) {
                    // Timeline line + dot
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.width(12.dp)
                    ) {
                        // Top line segment
                        Box(
                            modifier = Modifier
                                .width(2.dp)
                                .height(8.dp)
                                .background(MaterialTheme.colorScheme.outlineVariant)
                        )
                        // Dot
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.outline)
                        )
                        // Bottom line segment
                        Box(
                            modifier = Modifier
                                .width(2.dp)
                                .height(80.dp)
                                .background(MaterialTheme.colorScheme.outlineVariant)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    // Entry card
                    Box(modifier = Modifier.weight(1f).padding(bottom = 8.dp)) {
                        EntryCardItem(
                            entry = entry,
                            onClick = { onOpenEntry(entry.id) },
                            journalRepository = journalRepository
                        )
                    }
                }
            }
        }

        // Bottom spacer for FAB clearance
        item {
            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}
