package com.personal.cms.journal.ui.journal

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.personal.cms.journal.data.local.entity.JournalEntryEntity
import com.personal.cms.journal.data.repository.JournalRepository
import kotlinx.coroutines.launch

@Composable
fun JournalListScreen(
    journalRepository: JournalRepository,
    onOpenEntry: (String) -> Unit,
    onCreateNewEntry: () -> Unit
) {
    val entriesState by journalRepository.getEntriesFlow().collectAsState(initial = emptyList())
    var searchQuery by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<Pair<JournalEntryEntity, String>>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = onCreateNewEntry) {
                Icon(Icons.Default.Add, contentDescription = "New Entry")
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { query ->
                    searchQuery = query
                    if (query.isBlank()) {
                        isSearching = false
                        searchResults = emptyList()
                    } else {
                        isSearching = true
                        scope.launch {
                            searchResults = journalRepository.searchLocalEntries(query)
                        }
                    }
                },
                placeholder = { Text("Local E2EE search entries...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            val displayList = if (isSearching) searchResults.map { it.first } else entriesState

            if (displayList.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(if (isSearching) "No matching entries found." else "No entries yet. Tap '+' to create one.")
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(displayList) { entry ->
                        EntryCardItem(entry = entry, onClick = { onOpenEntry(entry.id) }, journalRepository = journalRepository)
                    }
                }
            }
        }
    }
}
