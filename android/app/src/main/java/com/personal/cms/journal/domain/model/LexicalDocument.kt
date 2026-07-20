package com.personal.cms.journal.domain.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

sealed class LexicalNode

data class LexicalDocument(
    val root: LexicalRootNode = LexicalRootNode()
)

data class LexicalRootNode(
    val children: List<LexicalNode> = emptyList(),
    val direction: String? = null,
    val format: String = "",
    val indent: Int = 0,
    val version: Int = 1
) : LexicalNode()

data class ParagraphNode(
    val children: List<LexicalNode> = emptyList(),
    val direction: String? = null,
    val format: String = "",
    val indent: Int = 0
) : LexicalNode()

data class HeadingNode(
    val tag: String = "h1", // h1, h2, h3
    val children: List<LexicalNode> = emptyList(),
    val direction: String? = null,
    val format: String = "",
    val indent: Int = 0
) : LexicalNode()

data class TextNode(
    val text: String,
    val format: Int = 0, // Bitfield: 1=bold, 2=italic, 4=strikethrough, 8=underline, 16=code, 32=subscript, 64=superscript
    val detail: Int = 0,
    val mode: String = "normal",
    val style: String? = null
) : LexicalNode()

data class ListNode(
    val listType: String = "bullet", // bullet, number, check
    val children: List<ListItemNode> = emptyList(),
    val start: Int = 1,
    val direction: String? = null
) : LexicalNode()

data class ListItemNode(
    val children: List<LexicalNode> = emptyList(),
    val value: Int = 1,
    val checked: Boolean? = null,
    val direction: String? = null
) : LexicalNode()

data class CodeNode(
    val language: String? = null,
    val children: List<LexicalNode> = emptyList()
) : LexicalNode()

data class QuoteNode(
    val children: List<LexicalNode> = emptyList()
) : LexicalNode()

data class TableNode(
    val children: List<TableRowNode> = emptyList()
) : LexicalNode()

data class TableRowNode(
    val children: List<TableCellNode> = emptyList()
) : LexicalNode()

data class TableCellNode(
    val children: List<LexicalNode> = emptyList(),
    val header: Boolean = false
) : LexicalNode()

data class LinkNode(
    val url: String,
    val children: List<LexicalNode> = emptyList()
) : LexicalNode()

data class JournalImageNode(
    val assetId: String,
    val width: Int? = null,
    val height: Int? = null,
    val alignment: String = "center", // left, center, right, full
    val caption: String = "",
    val displayMode: String = "inline"
) : LexicalNode()

data class MentionNode(
    val mentionType: String, // person, location, trip, project, collection
    val entityId: String,
    val entityName: String
) : LexicalNode()

data class UnknownNode(
    val rawJson: JsonObject
) : LexicalNode()
