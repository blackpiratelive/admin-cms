package com.personal.cms.journal.ui.editor

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.FormatListBulleted
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.personal.cms.journal.data.crypto.AssetEncryptor
import com.personal.cms.journal.data.crypto.KeystoreManager
import com.personal.cms.journal.domain.model.*
import com.personal.cms.journal.domain.usecase.LexicalParser
import java.util.UUID

data class JournalTemplate(val id: String, val name: String, val markdown: String)

val JOURNAL_TEMPLATES = listOf(
    JournalTemplate("daily", "Daily Reflection", "### What went well today?\n- \n\n### What could have been better?\n- \n\n### Gratitude\n- "),
    JournalTemplate("travel", "Travel Day", "### Day Highlights\n- \n\n### Locations Visited\n- \n\n### Food & Experiences\n- "),
    JournalTemplate("meeting", "Meeting Notes", "### Attendees\n- \n\n### Key Agenda & Notes\n- \n\n### Action Items\n- [ ] "),
    JournalTemplate("gratitude", "Gratitude Journal", "### 3 Things I'm Grateful For Today\n1. \n2. \n3. \n\n### Highlight of the Day\n- "),
    JournalTemplate("learning", "Learning Journal", "### Topic Learned\n- \n\n### Key Takeaways\n- \n\n### Questions & Follow-ups\n- ")
)

val JOURNAL_ENTRY_TYPES = listOf("daily", "reflection", "travel", "dream", "meeting", "ideas", "gratitude", "life_event", "health", "thoughts", "project", "learning", "custom")
val JOURNAL_MOODS = listOf("amazing 😁", "happy 😊", "good 🙂", "neutral 😐", "reflective 🤔", "energetic ⚡", "sad 😔", "tired 😴", "bad 😞", "terrible 😭")

@Composable
fun NativeLexicalEditor(
    initialLexicalJson: String,
    entryDate: String,
    entryType: String,
    mood: String?,
    onMetadataChanged: (date: String, type: String, mood: String?) -> Unit,
    onContentChanged: (lexicalJson: String, wordCount: Int, readingTime: Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val keystoreManager = remember { KeystoreManager(context) }

    var hasEdited by remember(initialLexicalJson) { mutableStateOf(false) }

    var textContent by remember(initialLexicalJson) {
        mutableStateOf(
            if (initialLexicalJson.isNotBlank()) {
                try {
                    LexicalParser.extractPlaintext(LexicalParser.parseLexicalJson(initialLexicalJson))
                } catch (e: Exception) {
                    ""
                }
            } else ""
        )
    }

    var selectedDate by remember(entryDate) { mutableStateOf(entryDate) }
    var selectedType by remember(entryType) { mutableStateOf(entryType) }
    var selectedMood by remember(mood) { mutableStateOf(mood ?: "good") }

    var showTemplateDialog by remember { mutableStateOf(false) }
    var showTypeDropdown by remember { mutableStateOf(false) }
    var showMoodDropdown by remember { mutableStateOf(false) }

    val wordCount = remember(textContent) { LexicalParser.calculateWordCount(textContent) }
    val readingTime = remember(wordCount) { LexicalParser.calculateReadingTime(wordCount) }

    LaunchedEffect(textContent, hasEdited) {
        val json = if (!hasEdited && initialLexicalJson.isNotBlank()) {
            initialLexicalJson
        } else {
            val lexicalDoc = LexicalParser.fromMarkdown(textContent)
            LexicalParser.toLexicalJson(lexicalDoc)
        }
        onContentChanged(json, wordCount, readingTime)
    }

    LaunchedEffect(selectedDate, selectedType, selectedMood) {
        onMetadataChanged(selectedDate, selectedType, selectedMood)
    }

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            val dek = keystoreManager.activeDEK ?: return@let
            try {
                val result = AssetEncryptor.processAndEncryptImage(context, uri, dek)
                val assetId = "jasset_${System.currentTimeMillis()}_${UUID.randomUUID().toString().substring(0, 4)}"
                AssetEncryptor.saveEncryptedAssetToFile(context, assetId, "thumb", result.encryptedThumbnailBytes)
                AssetEncryptor.saveEncryptedAssetToFile(context, assetId, "orig", result.encryptedOriginalBytes)

                textContent += "\n[Encrypted Image: $assetId]\n"
                hasEdited = true
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(12.dp))
    ) {
        // Metadata & Controls Header
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            shape = RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                // Row 1: Entry Date, Entry Type, Mood
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Date input
                    OutlinedTextField(
                        value = selectedDate,
                        onValueChange = { selectedDate = it },
                        label = { Text("Date") },
                        singleLine = true,
                        modifier = Modifier.weight(1.2f),
                        textStyle = LocalTextStyle.current.copy(fontSize = 14.sp)
                    )

                    // Type Selector
                    Box(modifier = Modifier.weight(1f)) {
                        OutlinedButton(
                            onClick = { showTypeDropdown = true },
                            modifier = Modifier.fillMaxWidth(),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp)
                        ) {
                            Text(selectedType, fontSize = 14.sp)
                        }
                        DropdownMenu(
                            expanded = showTypeDropdown,
                            onDismissRequest = { showTypeDropdown = false }
                        ) {
                            JOURNAL_ENTRY_TYPES.forEach { t ->
                                DropdownMenuItem(
                                    text = { Text(t) },
                                    onClick = {
                                        selectedType = t
                                        showTypeDropdown = false
                                    }
                                )
                            }
                        }
                    }

                    // Mood Selector
                    Box(modifier = Modifier.weight(1f)) {
                        OutlinedButton(
                            onClick = { showMoodDropdown = true },
                            modifier = Modifier.fillMaxWidth(),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp)
                        ) {
                            Text(selectedMood, fontSize = 14.sp)
                        }
                        DropdownMenu(
                            expanded = showMoodDropdown,
                            onDismissRequest = { showMoodDropdown = false }
                        ) {
                            JOURNAL_MOODS.forEach { m ->
                                DropdownMenuItem(
                                    text = { Text(m) },
                                    onClick = {
                                        selectedMood = m.split(" ")[0]
                                        showMoodDropdown = false
                                    }
                                )
                            }
                        }
                    }

                    // Template Trigger
                    IconButton(onClick = { showTemplateDialog = true }) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = "Templates", tint = MaterialTheme.colorScheme.primary)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Markdown Hints Toolbar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Markdown: # H1 • ## H2 • - List • > Quote",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    IconButton(onClick = { imagePickerLauncher.launch("image/*") }) {
                        Icon(Icons.Default.Image, contentDescription = "Insert E2EE Image", tint = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }

        // Stats bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.End
        ) {
            Text(
                text = "$wordCount words • $readingTime min read",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

        // Plain text / Markdown Input
        OutlinedTextField(
            value = textContent,
            onValueChange = { 
                textContent = it 
                hasEdited = true
            },
            placeholder = { Text("Write your journal entry... Use markdown for formatting (#, ##, -, >)...") },
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color.Transparent,
                unfocusedBorderColor = Color.Transparent
            ),
            textStyle = LocalTextStyle.current.copy(
                fontSize = 16.sp,
                lineHeight = 24.sp
            )
        )
    }

    // Template Selector Dialog
    if (showTemplateDialog) {
        AlertDialog(
            onDismissRequest = { showTemplateDialog = false },
            title = { Text("Choose Journal Template", style = MaterialTheme.typography.titleLarge) },
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    JOURNAL_TEMPLATES.forEach { t ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    textContent = t.markdown
                                    hasEdited = true
                                    showTemplateDialog = false
                                },
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = t.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showTemplateDialog = false }) {
                    Text("Cancel")
                }
            },
            shape = RoundedCornerShape(16.dp)
        )
    }
}
