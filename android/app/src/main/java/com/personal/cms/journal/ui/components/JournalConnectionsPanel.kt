package com.personal.cms.journal.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.personal.cms.journal.data.repository.JournalRepository
import com.personal.cms.journal.domain.usecase.LexicalParser
import kotlinx.coroutines.launch

@Composable
fun JournalConnectionsPanel(
    entryDate: String,
    locationId: String?,
    tripId: String?,
    journalRepository: JournalRepository,
    onLocationChange: (String?) -> Unit,
    onTripChange: (String?) -> Unit,
    modifier: Modifier = Modifier
) {
    val entriesState by journalRepository.getEntriesFlow().collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    
    val pastEntries = remember(entriesState, entryDate) {
        if (entryDate.length >= 10) {
            val monthDay = entryDate.substring(5, 10)
            val year = entryDate.substring(0, 4)
            entriesState.filter { 
                it.entryDate.length >= 10 && 
                it.entryDate.substring(5, 10) == monthDay &&
                it.entryDate.substring(0, 4) != year
            }.sortedByDescending { it.entryDate }
        } else emptyList()
    }

    Surface(
        modifier = modifier
            .fillMaxHeight()
            .width(280.dp)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp)),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Hub, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Context & Connections",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Location Link
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Place, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Location Link", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                        }

                        OutlinedTextField(
                            value = locationId ?: "",
                            onValueChange = { onLocationChange(it.ifBlank { null }) },
                            placeholder = { Text("Enter locationId or name...") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            textStyle = LocalTextStyle.current.copy(fontSize = 13.sp)
                        )
                    }
                }

                // Trip Link
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Explore, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Trip Link", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                        }

                        OutlinedTextField(
                            value = tripId ?: "",
                            onValueChange = { onTripChange(it.ifBlank { null }) },
                            placeholder = { Text("Enter tripId or title...") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            textStyle = LocalTextStyle.current.copy(fontSize = 13.sp)
                        )
                    }
                }

                // On This Day Activity Stream
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "ON THIS DAY ($entryDate)",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                if (pastEntries.isEmpty()) {
                    item {
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text("No journal entries on this day in past years.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                } else {
                    items(pastEntries) { pastEntry ->
                        var title by remember(pastEntry.id) { mutableStateOf("Journal Entry (${pastEntry.entryDate.substring(0, 4)})") }
                        
                        LaunchedEffect(pastEntry.id) {
                            val decrypted = journalRepository.decryptEntryContent(pastEntry)
                            val doc = LexicalParser.parseLexicalJson(decrypted)
                            val plain = LexicalParser.extractPlaintext(doc)
                            val firstLine = plain.lines().firstOrNull { it.isNotBlank() }?.trim()
                            if (!firstLine.isNullOrBlank()) {
                                title = if (firstLine.length > 30) firstLine.take(30) + "..." else firstLine
                            }
                        }
                        
                        Card(
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Book, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(pastEntry.entryDate.substring(0, 4), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(title, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }
    }
}
