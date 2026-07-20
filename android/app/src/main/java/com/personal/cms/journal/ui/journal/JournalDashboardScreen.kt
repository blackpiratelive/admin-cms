package com.personal.cms.journal.ui.journal

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.personal.cms.journal.data.local.entity.JournalEntryEntity
import com.personal.cms.journal.data.repository.JournalRepository
import com.personal.cms.journal.domain.usecase.LexicalParser
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun JournalDashboardScreen(
    journalRepository: JournalRepository,
    onOpenEntry: (String) -> Unit,
    onCreateNewEntry: () -> Unit
) {
    val entriesState by journalRepository.getEntriesFlow().collectAsState(initial = emptyList())
    var isSyncing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val totalEntries = entriesState.size
    val currentMonthStr = SimpleDateFormat("yyyy-MM", Locale.US).format(Date())
    val entriesThisMonth = entriesState.count { it.entryDate.startsWith(currentMonthStr) }
    val favorites = entriesState.filter { it.favorite == 1 }

    // Calculate writing streak
    val streakDays = remember(entriesState) {
        if (entriesState.isEmpty()) return@remember 0
        val dates = entriesState.map { it.entryDate }.distinct().sortedDescending()
        var streak = 0
        val cal = Calendar.getInstance()
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        var checkDate = sdf.format(cal.time)

        for (d in dates) {
            if (d == checkDate) {
                streak++
                cal.add(Calendar.DAY_OF_YEAR, -1)
                checkDate = sdf.format(cal.time)
            } else if (streak == 0) {
                cal.add(Calendar.DAY_OF_YEAR, -1)
                checkDate = sdf.format(cal.time)
                if (d == checkDate) {
                    streak++
                    cal.add(Calendar.DAY_OF_YEAR, -1)
                    checkDate = sdf.format(cal.time)
                } else break
            } else break
        }
        streak
    }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onCreateNewEntry,
                icon = { Icon(Icons.Default.Edit, contentDescription = "New Entry") },
                text = { Text("Write Entry") }
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Journal Overview",
                        style = MaterialTheme.typography.headlineMedium
                    )

                    IconButton(
                        onClick = {
                            scope.launch {
                                isSyncing = true
                                journalRepository.syncWithServer()
                                isSyncing = false
                            }
                        },
                        enabled = !isSyncing
                    ) {
                        if (isSyncing) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Sync, contentDescription = "Sync Now")
                        }
                    }
                }
            }

            // Stat Cards Row
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.LocalFireDepartment, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Streak", style = MaterialTheme.typography.labelMedium)
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("$streakDays Days", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("This Month", style = MaterialTheme.typography.labelMedium)
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("$entriesThisMonth", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Book, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Total", style = MaterialTheme.typography.labelMedium)
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("$totalEntries", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Recent Entries Header
            item {
                Text(
                    text = "Recent Entries",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }

            if (entriesState.isEmpty()) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("No journal entries yet. Tap 'Write Entry' to start journaling.")
                        }
                    }
                }
            } else {
                items(entriesState.take(5)) { entry ->
                    EntryCardItem(entry = entry, onClick = { onOpenEntry(entry.id) }, journalRepository = journalRepository)
                }
            }

            if (favorites.isNotEmpty()) {
                item {
                    Text(
                        text = "Favorite Entries",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                items(favorites.take(3)) { entry ->
                    EntryCardItem(entry = entry, onClick = { onOpenEntry(entry.id) }, journalRepository = journalRepository)
                }
            }
        }
    }
}

@Composable
fun EntryCardItem(
    entry: JournalEntryEntity,
    onClick: () -> Unit,
    journalRepository: JournalRepository? = null
) {
    var title by remember(entry.id) { mutableStateOf("Journal Entry (${entry.entryDate})") }

    LaunchedEffect(entry.id) {
        if (journalRepository != null) {
            val decrypted = journalRepository.decryptEntryContent(entry)
            val doc = LexicalParser.parseLexicalJson(decrypted)
            val plain = LexicalParser.extractPlaintext(doc)
            val firstLine = plain.lines().firstOrNull { it.isNotBlank() }?.trim()
            if (!firstLine.isNullOrBlank()) {
                title = if (firstLine.length > 50) firstLine.take(50) + "..." else firstLine
            }
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = entry.entryDate,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold
                    )
                    SuggestionChip(
                        onClick = {},
                        label = { Text(entry.entryType, fontSize = 10.sp) },
                        modifier = Modifier.height(22.dp)
                    )
                    if (entry.mood != null) {
                        Text(text = "Mood: ${entry.mood}", style = MaterialTheme.typography.bodySmall)
                    }
                    Text(
                        text = "${entry.wordCount} words • ${entry.readingTime} min",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                if (entry.favorite == 1) {
                    Icon(Icons.Default.Star, contentDescription = "Favorite", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
