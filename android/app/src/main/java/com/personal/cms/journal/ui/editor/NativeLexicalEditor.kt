package com.personal.cms.journal.ui.editor

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.FormatListBulleted
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
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

    var textContent by remember {
        mutableStateOf(
            if (initialLexicalJson.isNotBlank()) {
                LexicalParser.extractPlaintext(LexicalParser.parseLexicalJson(initialLexicalJson))
            } else ""
        )
    }

    // Fix: Re-populate textContent when initialLexicalJson finishes loading from DB
    LaunchedEffect(initialLexicalJson) {
        if (initialLexicalJson.isNotBlank()) {
            val parsedText = LexicalParser.extractPlaintext(LexicalParser.parseLexicalJson(initialLexicalJson))
            if (parsedText.isNotBlank() && parsedText != textContent) {
                textContent = parsedText
            }
        }
    }

    var selectedDate by remember(entryDate) { mutableStateOf(entryDate) }
    var selectedType by remember(entryType) { mutableStateOf(entryType) }
    var selectedMood by remember(mood) { mutableStateOf(mood ?: "good") }

    var isBold by remember { mutableStateOf(false) }
    var isItalic by remember { mutableStateOf(false) }
    var isHeading1 by remember { mutableStateOf(false) }
    var isHeading2 by remember { mutableStateOf(false) }
    var isList by remember { mutableStateOf(false) }
    var isQuote by remember { mutableStateOf(false) }
    var isCode by remember { mutableStateOf(false) }

    var showTemplateDialog by remember { mutableStateOf(false) }
    var showTypeDropdown by remember { mutableStateOf(false) }
    var showMoodDropdown by remember { mutableStateOf(false) }

    val doc = remember(textContent, isHeading1, isHeading2, isList, isQuote, isCode, isBold, isItalic) {
        val formatBitfield = (if (isBold) 1 else 0) or (if (isItalic) 2 else 0) or (if (isCode) 16 else 0)
        val rootNodes = mutableListOf<LexicalNode>()
        val lines = textContent.split("\n")

        for (line in lines) {
            val textNode = TextNode(text = line, format = formatBitfield)
            when {
                isHeading1 || line.startsWith("# ") -> {
                    val cleanText = TextNode(text = line.removePrefix("# "))
                    rootNodes.add(HeadingNode(tag = "h1", children = listOf(cleanText)))
                }
                isHeading2 || line.startsWith("## ") -> {
                    val cleanText = TextNode(text = line.removePrefix("## "))
                    rootNodes.add(HeadingNode(tag = "h2", children = listOf(cleanText)))
                }
                isQuote || line.startsWith("> ") -> {
                    val cleanText = TextNode(text = line.removePrefix("> "))
                    rootNodes.add(QuoteNode(children = listOf(cleanText)))
                }
                isList || line.startsWith("- ") || line.startsWith("* ") -> {
                    val cleanText = TextNode(text = line.removePrefix("- ").removePrefix("* "))
                    val item = ListItemNode(children = listOf(cleanText))
                    rootNodes.add(ListNode(listType = "bullet", children = listOf(item)))
                }
                else -> {
                    rootNodes.add(ParagraphNode(children = listOf(textNode)))
                }
            }
        }
        LexicalDocument(root = LexicalRootNode(children = rootNodes))
    }

    val wordCount = remember(textContent) { LexicalParser.calculateWordCount(textContent) }
    val readingTime = remember(wordCount) { LexicalParser.calculateReadingTime(wordCount) }

    LaunchedEffect(doc) {
        onContentChanged(LexicalParser.toLexicalJson(doc), wordCount, readingTime)
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
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surface)
    ) {
        // Metadata & Controls Header
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(10.dp)) {
                // Row 1: Entry Date, Entry Type, Mood
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Date input
                    OutlinedTextField(
                        value = selectedDate,
                        onValueChange = { selectedDate = it },
                        label = { Text("Date") },
                        singleLine = true,
                        modifier = Modifier.weight(1.2f),
                        textStyle = LocalTextStyle.current.copy(fontSize = 12.sp)
                    )

                    // Type Selector
                    Box(modifier = Modifier.weight(1f)) {
                        OutlinedButton(
                            onClick = { showTypeDropdown = true },
                            modifier = Modifier.fillMaxWidth(),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(selectedType, fontSize = 12.sp)
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
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(selectedMood, fontSize = 12.sp)
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

                Spacer(modifier = Modifier.height(6.dp))

                // Row 2: Rich Text Toolbar
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    item {
                        IconButton(onClick = { isBold = !isBold }) {
                            Icon(Icons.Default.FormatBold, contentDescription = "Bold", tint = if (isBold) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    item {
                        IconButton(onClick = { isItalic = !isItalic }) {
                            Icon(Icons.Default.FormatItalic, contentDescription = "Italic", tint = if (isItalic) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    item {
                        IconButton(onClick = { isHeading1 = !isHeading1; if (isHeading1) isHeading2 = false }) {
                            Text("H1", fontWeight = FontWeight.Bold, color = if (isHeading1) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    item {
                        IconButton(onClick = { isHeading2 = !isHeading2; if (isHeading2) isHeading1 = false }) {
                            Text("H2", fontWeight = FontWeight.Bold, color = if (isHeading2) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    item {
                        IconButton(onClick = { isList = !isList }) {
                            Icon(Icons.AutoMirrored.Filled.FormatListBulleted, contentDescription = "Bullet List", tint = if (isList) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    item {
                        IconButton(onClick = { isQuote = !isQuote }) {
                            Icon(Icons.Default.FormatQuote, contentDescription = "Quote", tint = if (isQuote) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    item {
                        IconButton(onClick = { isCode = !isCode }) {
                            Icon(Icons.Default.Code, contentDescription = "Code Block", tint = if (isCode) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    item {
                        IconButton(onClick = { imagePickerLauncher.launch("image/*") }) {
                            Icon(Icons.Default.Image, contentDescription = "Insert E2EE Image", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        }

        // Stats bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.End
        ) {
            Text(
                text = "$wordCount words • $readingTime min read",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

        // Native Rich Text Input
        OutlinedTextField(
            value = textContent,
            onValueChange = { textContent = it },
            placeholder = { Text("Write your journal entry... Type '/' or markdown shortcuts (#, -, >)...") },
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color.Transparent,
                unfocusedBorderColor = Color.Transparent
            ),
            textStyle = LocalTextStyle.current.copy(
                fontSize = 16.sp,
                lineHeight = 24.sp,
                fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal,
                fontStyle = if (isItalic) FontStyle.Italic else FontStyle.Normal
            )
        )
    }

    // Template Selector Dialog
    if (showTemplateDialog) {
        AlertDialog(
            onDismissRequest = { showTemplateDialog = false },
            title = { Text("Choose Journal Template") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    JOURNAL_TEMPLATES.forEach { t ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    val docT = LexicalParser.fromMarkdown(t.markdown)
                                    textContent = LexicalParser.extractPlaintext(docT)
                                    showTemplateDialog = false
                                }
                        ) {
                            Text(
                                text = t.name,
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showTemplateDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
