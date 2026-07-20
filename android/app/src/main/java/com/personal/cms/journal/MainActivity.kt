package com.personal.cms.journal

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import com.personal.cms.journal.data.crypto.KeystoreManager
import com.personal.cms.journal.data.repository.AuthRepository
import com.personal.cms.journal.data.repository.JournalRepository
import com.personal.cms.journal.ui.auth.LoginScreen
import com.personal.cms.journal.ui.components.AdaptiveNavigationContainer
import com.personal.cms.journal.ui.components.JournalConnectionsPanel
import com.personal.cms.journal.ui.components.JournalScreen
import com.personal.cms.journal.ui.editor.NativeLexicalEditor
import com.personal.cms.journal.ui.journal.JournalCalendarScreen
import com.personal.cms.journal.ui.journal.JournalDashboardScreen
import com.personal.cms.journal.ui.journal.JournalListScreen
import com.personal.cms.journal.ui.journal.JournalTimelineScreen
import com.personal.cms.journal.ui.onboarding.OnboardingScreen
import com.personal.cms.journal.ui.settings.SettingsScreen
import com.personal.cms.journal.ui.theme.PersonalCMSJournalTheme
import kotlin.OptIn
import androidx.compose.material3.ExperimentalMaterial3Api
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val keystoreManager = KeystoreManager(this)
        val authRepository = AuthRepository(this)
        val journalRepository = JournalRepository(this)

        setContent {
            PersonalCMSJournalTheme {
                val configuration = LocalConfiguration.current
                val isExpandedScreen = configuration.screenWidthDp >= 600

                var currentAppState by remember {
                    mutableStateOf(
                        when {
                            keystoreManager.getBaseUrl() == null -> "onboarding"
                            !authRepository.isUnlocked() -> "auth"
                            else -> "main"
                        }
                    )
                }

                var currentTab by remember { mutableStateOf(JournalScreen.Dashboard) }
                var activeEditorEntryId by remember { mutableStateOf<String?>(null) }
                var editorInitialDate by remember { mutableStateOf<String?>(null) }
                var isEditing by remember { mutableStateOf(false) }

                Surface(modifier = Modifier.fillMaxSize()) {
                    when (currentAppState) {
                        "onboarding" -> {
                            OnboardingScreen(
                                authRepository = authRepository,
                                keystoreManager = keystoreManager,
                                onOnboardingComplete = { currentAppState = "auth" }
                            )
                        }

                        "auth" -> {
                            LoginScreen(
                                authRepository = authRepository,
                                keystoreManager = keystoreManager,
                                onLoginSuccess = { currentAppState = "main" },
                                onChangeInstance = { currentAppState = "onboarding" }
                            )
                        }

                        "main" -> {
                            LaunchedEffect(Unit) {
                                journalRepository.syncWithServer()
                            }

                            if (isEditing) {
                                var editorLexicalJson by remember { mutableStateOf("") }
                                var initialJson by remember { mutableStateOf("") }
                                var isSaving by remember { mutableStateOf(false) }
                                var showConnectionsSheet by remember { mutableStateOf(false) }

                                var editorDate by remember { mutableStateOf(editorInitialDate ?: SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())) }
                                var editorType by remember { mutableStateOf("daily") }
                                var editorMood by remember { mutableStateOf<String?>("good") }
                                var locationId by remember { mutableStateOf<String?>(null) }
                                var tripId by remember { mutableStateOf<String?>(null) }

                                val scope = rememberCoroutineScope()

                                LaunchedEffect(activeEditorEntryId) {
                                    if (activeEditorEntryId != null) {
                                        val entry = journalRepository.getEntryById(activeEditorEntryId!!)
                                        if (entry != null) {
                                            editorDate = entry.entryDate
                                            editorType = entry.entryType
                                            editorMood = entry.mood
                                            locationId = entry.locationId
                                            tripId = entry.tripId
                                            initialJson = journalRepository.decryptEntryContent(entry)
                                        }
                                    }
                                }

                                Scaffold(
                                    topBar = {
                                        TopAppBar(
                                            title = { Text(if (activeEditorEntryId != null) "Edit Entry" else "New Entry") },
                                            navigationIcon = {
                                                IconButton(onClick = { isEditing = false }) {
                                                    Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                                                }
                                            },
                                            actions = {
                                                if (!isExpandedScreen) {
                                                    IconButton(onClick = { showConnectionsSheet = true }) {
                                                        Icon(Icons.Default.Share, contentDescription = "Context & Connections", tint = MaterialTheme.colorScheme.primary)
                                                    }
                                                }
                                                IconButton(
                                                    onClick = {
                                                        scope.launch {
                                                            isSaving = true
                                                            try {
                                                                journalRepository.saveJournalEntry(
                                                                    entryDate = editorDate,
                                                                    contentLexicalJson = editorLexicalJson,
                                                                    entryType = editorType,
                                                                    mood = editorMood,
                                                                    locationId = locationId,
                                                                    tripId = tripId,
                                                                    existingId = activeEditorEntryId
                                                                )
                                                                journalRepository.syncWithServer()
                                                                isEditing = false
                                                            } catch (e: Exception) {
                                                                e.printStackTrace()
                                                            } finally {
                                                                isSaving = false
                                                            }
                                                        }
                                                    },
                                                    enabled = !isSaving
                                                ) {
                                                    Icon(Icons.Default.Save, contentDescription = "Save Entry")
                                                }
                                            }
                                        )
                                    }
                                ) { padding ->
                                    Box(modifier = Modifier.padding(padding)) {
                                        if (isExpandedScreen) {
                                            // Tablet / Wide Screen: Persistent 2-pane side by side
                                            Row(
                                                modifier = Modifier.fillMaxSize().padding(8.dp),
                                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                                            ) {
                                                NativeLexicalEditor(
                                                    initialLexicalJson = initialJson,
                                                    entryDate = editorDate,
                                                    entryType = editorType,
                                                    mood = editorMood,
                                                    onMetadataChanged = { d, t, m ->
                                                        editorDate = d
                                                        editorType = t
                                                        editorMood = m
                                                    },
                                                    onContentChanged = { json, _, _ ->
                                                        editorLexicalJson = json
                                                    },
                                                    modifier = Modifier.weight(1f)
                                                )

                                                JournalConnectionsPanel(
                                                    entryDate = editorDate,
                                                    locationId = locationId,
                                                    tripId = tripId,
                                                    onLocationChange = { locationId = it },
                                                    onTripChange = { tripId = it }
                                                )
                                            }
                                        } else {
                                            // Phone / Compact Screen: Editor full screen
                                            NativeLexicalEditor(
                                                initialLexicalJson = initialJson,
                                                entryDate = editorDate,
                                                entryType = editorType,
                                                mood = editorMood,
                                                onMetadataChanged = { d, t, m ->
                                                    editorDate = d
                                                    editorType = t
                                                    editorMood = m
                                                },
                                                onContentChanged = { json, _, _ ->
                                                    editorLexicalJson = json
                                                },
                                                modifier = Modifier.fillMaxSize().padding(8.dp)
                                            )

                                            // Bottom Sheet / Side Sheet for Phone Connections & Context
                                            if (showConnectionsSheet) {
                                                ModalBottomSheet(
                                                    onDismissRequest = { showConnectionsSheet = false }
                                                ) {
                                                    JournalConnectionsPanel(
                                                        entryDate = editorDate,
                                                        locationId = locationId,
                                                        tripId = tripId,
                                                        onLocationChange = { locationId = it },
                                                        onTripChange = { tripId = it },
                                                        modifier = Modifier.fillMaxWidth().padding(16.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                AdaptiveNavigationContainer(
                                    currentScreen = currentTab,
                                    onNavigate = { currentTab = it },
                                    isExpandedScreen = isExpandedScreen
                                ) {
                                    when (currentTab) {
                                        JournalScreen.Dashboard -> {
                                            JournalDashboardScreen(
                                                journalRepository = journalRepository,
                                                onOpenEntry = { id ->
                                                    activeEditorEntryId = id
                                                    editorInitialDate = null
                                                    isEditing = true
                                                },
                                                onCreateNewEntry = {
                                                    activeEditorEntryId = null
                                                    editorInitialDate = null
                                                    isEditing = true
                                                }
                                            )
                                        }

                                        JournalScreen.Entries -> {
                                            JournalListScreen(
                                                journalRepository = journalRepository,
                                                onOpenEntry = { id ->
                                                    activeEditorEntryId = id
                                                    editorInitialDate = null
                                                    isEditing = true
                                                },
                                                onCreateNewEntry = {
                                                    activeEditorEntryId = null
                                                    editorInitialDate = null
                                                    isEditing = true
                                                }
                                            )
                                        }

                                        JournalScreen.Timeline -> {
                                            JournalTimelineScreen(
                                                journalRepository = journalRepository,
                                                onOpenEntry = { id ->
                                                    activeEditorEntryId = id
                                                    editorInitialDate = null
                                                    isEditing = true
                                                }
                                            )
                                        }

                                        JournalScreen.Calendar -> {
                                            JournalCalendarScreen(
                                                journalRepository = journalRepository,
                                                onOpenEntry = { id ->
                                                    activeEditorEntryId = id
                                                    editorInitialDate = null
                                                    isEditing = true
                                                },
                                                onCreateForDate = { dateStr ->
                                                    activeEditorEntryId = null
                                                    editorInitialDate = dateStr
                                                    isEditing = true
                                                }
                                            )
                                        }

                                        JournalScreen.Settings -> {
                                            SettingsScreen(
                                                authRepository = authRepository,
                                                journalRepository = journalRepository,
                                                keystoreManager = keystoreManager,
                                                onChangeInstance = { currentAppState = "onboarding" },
                                                onLogout = { currentAppState = "auth" }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
