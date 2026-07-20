package com.personal.cms.journal.ui.journal

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.personal.cms.journal.data.local.entity.JournalEntryEntity
import com.personal.cms.journal.data.repository.JournalRepository
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun JournalCalendarScreen(
    journalRepository: JournalRepository,
    onOpenEntry: (String) -> Unit,
    onCreateForDate: (String) -> Unit
) {
    val entriesState by journalRepository.getEntriesFlow().collectAsState(initial = emptyList())
    var currentCalendar by remember { mutableStateOf(Calendar.getInstance()) }

    val monthYearFormat = remember { SimpleDateFormat("MMMM yyyy", Locale.US) }
    val entryDateMap = remember(entriesState) {
        entriesState.associateBy { it.entryDate }
    }

    val daysInMonth = currentCalendar.getActualMaximum(Calendar.DAY_OF_MONTH)
    val tempCal = currentCalendar.clone() as Calendar
    tempCal.set(Calendar.DAY_OF_MONTH, 1)
    val firstDayOfWeek = tempCal.get(Calendar.DAY_OF_WEEK) - 1

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Month navigation header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = {
                val newCal = currentCalendar.clone() as Calendar
                newCal.add(Calendar.MONTH, -1)
                currentCalendar = newCal
            }) {
                Icon(Icons.Default.ChevronLeft, contentDescription = "Previous Month")
            }

            Text(
                text = monthYearFormat.format(currentCalendar.time),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            IconButton(onClick = {
                val newCal = currentCalendar.clone() as Calendar
                newCal.add(Calendar.MONTH, 1)
                currentCalendar = newCal
            }) {
                Icon(Icons.Default.ChevronRight, contentDescription = "Next Month")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Weekday Headers
        Row(modifier = Modifier.fillMaxWidth()) {
            val days = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
            days.forEach { day ->
                Text(
                    text = day,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Calendar Grid
        LazyVerticalGrid(
            columns = GridCells.Fixed(7),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Empty leading days
            items(firstDayOfWeek) {
                Box(modifier = Modifier.size(40.dp))
            }

            // Days of month
            items(daysInMonth) { dayIndex ->
                val day = dayIndex + 1
                val year = currentCalendar.get(Calendar.YEAR)
                val month = currentCalendar.get(Calendar.MONTH) + 1
                val dateStr = String.format(Locale.US, "%04d-%02d-%02d", year, month, day)

                val entry = entryDateMap[dateStr]
                val hasEntry = entry != null

                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(
                            if (hasEntry) MaterialTheme.colorScheme.primaryContainer else Color.Transparent
                        )
                        .clickable {
                            if (hasEntry) {
                                onOpenEntry(entry!!.id)
                            } else {
                                onCreateForDate(dateStr)
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = day.toString(),
                        fontWeight = if (hasEntry) FontWeight.Bold else FontWeight.Normal,
                        color = if (hasEntry) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}
