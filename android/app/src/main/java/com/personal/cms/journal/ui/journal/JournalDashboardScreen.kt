package com.personal.cms.journal.ui.journal

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
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

    val greeting = remember {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        when (hour) {
            in 0..11 -> "Good morning"
            in 12..16 -> "Good afternoon"
            else -> "Good evening"
        }
    }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onCreateNewEntry,
                icon = { Icon(Icons.Default.Edit, contentDescription = "New Entry") },
                text = { Text("Write Entry", fontWeight = FontWeight.SemiBold) },
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                shape = RoundedCornerShape(16.dp)
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = greeting,
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "Your Journal",
                            style = MaterialTheme.typography.headlineLarge,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    FilledIconButton(
                        onClick = {
                            scope.launch {
                                isSyncing = true
                                journalRepository.syncWithServer()
                                isSyncing = false
                            }
                        },
                        enabled = !isSyncing,
                        colors = IconButtonDefaults.filledIconButtonColors(
                            containerColor = MaterialTheme.colorScheme.secondaryContainer
                        )
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
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    StatCard(
                        modifier = Modifier.weight(1f),
                        title = "Streak",
                        value = "$streakDays",
                        subtitle = "Days",
                        icon = Icons.Default.LocalFireDepartment,
                        colors = listOf(Color(0xFFFFA726), Color(0xFFFF7043))
                    )
                    StatCard(
                        modifier = Modifier.weight(1f),
                        title = "This Month",
                        value = "$entriesThisMonth",
                        subtitle = "Entries",
                        icon = Icons.Default.CalendarMonth,
                        colors = listOf(Color(0xFF42A5F5), Color(0xFF1E88E5))
                    )
                    StatCard(
                        modifier = Modifier.weight(1f),
                        title = "Total",
                        value = "$totalEntries",
                        subtitle = "Entries",
                        icon = Icons.Default.Book,
                        colors = listOf(Color(0xFFAB47BC), Color(0xFF8E24AA))
                    )
                }
            }

            // Recent Entries Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Recent Entries",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    HorizontalDivider(modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.surfaceVariant)
                }
            }

            if (entriesState.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    ) {
                        Column(
                            modifier = Modifier.padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                Icons.Default.EditNote,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                "No journal entries yet",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "Tap 'Write Entry' to start journaling.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
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
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Favorites",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        HorizontalDivider(modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.surfaceVariant)
                    }
                }
                items(favorites.take(3)) { entry ->
                    EntryCardItem(entry = entry, onClick = { onOpenEntry(entry.id) }, journalRepository = journalRepository)
                }
            }
        }
    }
}

@Composable
fun StatCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    colors: List<Color>
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Box(
            modifier = Modifier
                .background(Brush.linearGradient(colors))
                .padding(16.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(title, style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = 0.8f))
                    Icon(icon, contentDescription = null, tint = Color.White.copy(alpha = 0.8f), modifier = Modifier.size(16.dp))
                }
                Spacer(modifier = Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = Color.White)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(subtitle, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.8f), modifier = Modifier.padding(bottom = 4.dp))
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
    var title by remember(entry.id) { mutableStateOf("Journal Entry") }
    var preview by remember(entry.id) { mutableStateOf("") }

    LaunchedEffect(entry.id) {
        if (journalRepository != null) {
            try {
                val decrypted = journalRepository.decryptEntryContent(entry)
                val doc = LexicalParser.parseLexicalJson(decrypted)
                val plain = LexicalParser.extractPlaintext(doc)
                val lines = plain.lines().filter { it.isNotBlank() }
                if (lines.isNotEmpty()) {
                    title = lines.first().trim()
                    if (lines.size > 1) {
                        preview = lines.drop(1).joinToString(" ").take(100)
                    }
                }
            } catch (e: Exception) {
                // Keep default
            }
        }
    }

    val displayDate = remember(entry.entryDate) {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val todayStr = sdf.format(Date())
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, -1)
        val yesterdayStr = sdf.format(cal.time)
        when (entry.entryDate) {
            todayStr -> "Today"
            yesterdayStr -> "Yesterday"
            else -> {
                try {
                    val date = sdf.parse(entry.entryDate)
                    SimpleDateFormat("MMM dd, yyyy", Locale.US).format(date!!)
                } catch (e: Exception) {
                    entry.entryDate
                }
            }
        }
    }

    val moodEmoji = when (entry.mood?.lowercase()) {
        "happy" -> "😊"
        "sad" -> "😢"
        "excited" -> "🤩"
        "angry" -> "😠"
        "calm" -> "😌"
        "anxious" -> "😰"
        "tired" -> "😴"
        else -> entry.mood ?: "📝"
    }
    
    // Convert short moods to emojis, otherwise take the first char or a default
    val displayMood = if (moodEmoji.length > 2) "📝" else moodEmoji

    val typeColor = when (entry.entryType.lowercase()) {
        "daily" -> MaterialTheme.colorScheme.primaryContainer
        "gratitude" -> MaterialTheme.colorScheme.tertiaryContainer
        "reflection" -> MaterialTheme.colorScheme.secondaryContainer
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
    val typeTextColor = when (entry.entryType.lowercase()) {
        "daily" -> MaterialTheme.colorScheme.onPrimaryContainer
        "gratitude" -> MaterialTheme.colorScheme.onTertiaryContainer
        "reflection" -> MaterialTheme.colorScheme.onSecondaryContainer
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Mood / Avatar
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = displayMood, fontSize = 24.sp)
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = displayDate,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold
                    )
                    
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (entry.favorite == 1) {
                            Icon(
                                Icons.Default.Star,
                                contentDescription = "Favorite",
                                tint = Color(0xFFFFC107),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        // Sync indicator
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (entry.isSynced) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                if (preview.isNotBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = preview,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                
                Spacer(modifier = Modifier.height(12.dp))
                
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Surface(
                        color = typeColor,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = entry.entryType.uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            color = typeTextColor,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                    
                    Text(
                        text = "${entry.wordCount} words • ${entry.readingTime} min",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
