package com.personal.cms.journal

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import com.personal.cms.journal.data.crypto.KeystoreManager
import com.personal.cms.journal.data.repository.AuthRepository
import com.personal.cms.journal.data.repository.JournalRepository
import com.personal.cms.journal.ui.auth.LoginScreen
import com.personal.cms.journal.ui.components.AdaptiveNavigationContainer
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
                            if (isEditing) {
                                var editorLexicalJson by remember { mutableStateOf("") }
                                var initialJson by remember { mutableStateOf("") }
                                var isSaving by remember { mutableStateOf(false) }
                                val scope = rememberCoroutineScope()

                                LaunchedEffect(activeEditorEntryId) {
                                    if (activeEditorEntryId != null) {
                                        val entry = journalRepository.getEntryById(activeEditorEntryId!!)
                                        if (entry != null) {
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
                                                IconButton(
                                                    onClick = {
                                                        scope.launch {
                                                            isSaving = true
                                                            val dateStr = editorInitialDate ?: SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                                                            journalRepository.saveJournalEntry(
                                                                entryDate = dateStr,
                                                                contentLexicalJson = editorLexicalJson,
                                                                existingId = activeEditorEntryId
                                                            )
                                                            isSaving = false
                                                            isEditing = false
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
                                        NativeLexicalEditor(
                                            initialLexicalJson = initialJson,
                                            onContentChanged = { json, _, _ ->
                                                editorLexicalJson = json
                                            }
                                        )
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
