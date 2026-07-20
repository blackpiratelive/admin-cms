package com.personal.cms.journal.domain.usecase

import com.personal.cms.journal.domain.model.*
import kotlinx.serialization.json.*

object LexicalParser {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        prettyPrint = false
    }

    fun parseLexicalJson(jsonStr: String): LexicalDocument {
        if (jsonStr.isBlank()) return LexicalDocument()
        return try {
            val rootObj = json.parseToJsonElement(jsonStr).jsonObject
            val rootNodeObj = rootObj["root"]?.jsonObject
            val rootNode = if (rootNodeObj != null) parseRootNode(rootNodeObj) else LexicalRootNode()
            LexicalDocument(root = rootNode)
        } catch (e: Exception) {
            // Fallback for raw text or malformed JSON
            val textNode = TextNode(text = jsonStr)
            val pNode = ParagraphNode(children = listOf(textNode))
            LexicalDocument(root = LexicalRootNode(children = listOf(pNode)))
        }
    }

    private fun parseRootNode(obj: JsonObject): LexicalRootNode {
        val childrenArray = obj["children"]?.jsonArray ?: JsonArray(emptyList())
        val children = childrenArray.map { parseNode(it.jsonObject) }
        val direction = obj["direction"]?.jsonPrimitive?.contentOrNull
        val format = obj["format"]?.jsonPrimitive?.contentOrNull ?: ""
        val indent = obj["indent"]?.jsonPrimitive?.intOrNull ?: 0
        val version = obj["version"]?.jsonPrimitive?.intOrNull ?: 1
        return LexicalRootNode(
            children = children,
            direction = direction,
            format = format,
            indent = indent,
            version = version
        )
    }

    private fun parseNode(obj: JsonObject): LexicalNode {
        val type = obj["type"]?.jsonPrimitive?.contentOrNull ?: return UnknownNode(obj)

        return when (type) {
            "paragraph" -> {
                val children = obj["children"]?.jsonArray?.map { parseNode(it.jsonObject) } ?: emptyList()
                ParagraphNode(
                    children = children,
                    direction = obj["direction"]?.jsonPrimitive?.contentOrNull,
                    format = obj["format"]?.jsonPrimitive?.contentOrNull ?: "",
                    indent = obj["indent"]?.jsonPrimitive?.intOrNull ?: 0
                )
            }
            "heading" -> {
                val tag = obj["tag"]?.jsonPrimitive?.contentOrNull ?: "h1"
                val children = obj["children"]?.jsonArray?.map { parseNode(it.jsonObject) } ?: emptyList()
                HeadingNode(
                    tag = tag,
                    children = children,
                    direction = obj["direction"]?.jsonPrimitive?.contentOrNull,
                    format = obj["format"]?.jsonPrimitive?.contentOrNull ?: "",
                    indent = obj["indent"]?.jsonPrimitive?.intOrNull ?: 0
                )
            }
            "text" -> {
                TextNode(
                    text = obj["text"]?.jsonPrimitive?.contentOrNull ?: "",
                    format = obj["format"]?.jsonPrimitive?.intOrNull ?: 0,
                    detail = obj["detail"]?.jsonPrimitive?.intOrNull ?: 0,
                    mode = obj["mode"]?.jsonPrimitive?.contentOrNull ?: "normal",
                    style = obj["style"]?.jsonPrimitive?.contentOrNull
                )
            }
            "list" -> {
                val listType = obj["listType"]?.jsonPrimitive?.contentOrNull ?: "bullet"
                val children = obj["children"]?.jsonArray?.map { parseNode(it.jsonObject) }
                    ?.filterIsInstance<ListItemNode>() ?: emptyList()
                ListNode(
                    listType = listType,
                    children = children,
                    start = obj["start"]?.jsonPrimitive?.intOrNull ?: 1,
                    direction = obj["direction"]?.jsonPrimitive?.contentOrNull
                )
            }
            "listitem" -> {
                val children = obj["children"]?.jsonArray?.map { parseNode(it.jsonObject) } ?: emptyList()
                ListItemNode(
                    children = children,
                    value = obj["value"]?.jsonPrimitive?.intOrNull ?: 1,
                    checked = obj["checked"]?.jsonPrimitive?.booleanOrNull,
                    direction = obj["direction"]?.jsonPrimitive?.contentOrNull
                )
            }
            "quote" -> {
                val children = obj["children"]?.jsonArray?.map { parseNode(it.jsonObject) } ?: emptyList()
                QuoteNode(children = children)
            }
            "code" -> {
                val language = obj["language"]?.jsonPrimitive?.contentOrNull
                val children = obj["children"]?.jsonArray?.map { parseNode(it.jsonObject) } ?: emptyList()
                CodeNode(language = language, children = children)
            }
            "table" -> {
                val children = obj["children"]?.jsonArray?.map { parseNode(it.jsonObject) }
                    ?.filterIsInstance<TableRowNode>() ?: emptyList()
                TableNode(children = children)
            }
            "tablerow" -> {
                val children = obj["children"]?.jsonArray?.map { parseNode(it.jsonObject) }
                    ?.filterIsInstance<TableCellNode>() ?: emptyList()
                TableRowNode(children = children)
            }
            "tablecell" -> {
                val children = obj["children"]?.jsonArray?.map { parseNode(it.jsonObject) } ?: emptyList()
                TableCellNode(
                    children = children,
                    header = obj["header"]?.jsonPrimitive?.booleanOrNull ?: false
                )
            }
            "link", "autolink" -> {
                val url = obj["url"]?.jsonPrimitive?.contentOrNull ?: ""
                val children = obj["children"]?.jsonArray?.map { parseNode(it.jsonObject) } ?: emptyList()
                LinkNode(url = url, children = children)
            }
            "journal-image" -> {
                JournalImageNode(
                    assetId = obj["assetId"]?.jsonPrimitive?.contentOrNull ?: "",
                    width = obj["width"]?.jsonPrimitive?.intOrNull,
                    height = obj["height"]?.jsonPrimitive?.intOrNull,
                    alignment = obj["alignment"]?.jsonPrimitive?.contentOrNull ?: "center",
                    caption = obj["caption"]?.jsonPrimitive?.contentOrNull ?: "",
                    displayMode = obj["displayMode"]?.jsonPrimitive?.contentOrNull ?: "inline"
                )
            }
            "person-mention", "location-mention", "trip-mention", "project-mention", "collection-mention" -> {
                MentionNode(
                    mentionType = type.removeSuffix("-mention"),
                    entityId = obj["entityId"]?.jsonPrimitive?.contentOrNull ?: "",
                    entityName = obj["entityName"]?.jsonPrimitive?.contentOrNull ?: ""
                )
            }
            else -> UnknownNode(obj)
        }
    }

    fun toLexicalJson(doc: LexicalDocument): String {
        val rootObj = buildJsonObject {
            put("root", buildRootJsonObject(doc.root))
        }
        return rootObj.toString()
    }

    private fun buildRootJsonObject(rootNode: LexicalRootNode): JsonObject {
        return buildJsonObject {
            put("type", "root")
            put("children", buildJsonArray {
                rootNode.children.forEach { add(nodeToJsonElement(it)) }
            })
            put("direction", rootNode.direction)
            put("format", rootNode.format)
            put("indent", rootNode.indent)
            put("version", rootNode.version)
        }
    }

    private fun nodeToJsonElement(node: LexicalNode): JsonElement {
        return when (node) {
            is ParagraphNode -> buildJsonObject {
                put("type", "paragraph")
                put("children", buildJsonArray { node.children.forEach { add(nodeToJsonElement(it)) } })
                put("direction", node.direction)
                put("format", node.format)
                put("indent", node.indent)
                put("version", 1)
            }
            is HeadingNode -> buildJsonObject {
                put("type", "heading")
                put("tag", node.tag)
                put("children", buildJsonArray { node.children.forEach { add(nodeToJsonElement(it)) } })
                put("direction", node.direction)
                put("format", node.format)
                put("indent", node.indent)
                put("version", 1)
            }
            is TextNode -> buildJsonObject {
                put("type", "text")
                put("text", node.text)
                put("format", node.format)
                put("detail", node.detail)
                put("mode", node.mode)
                node.style?.let { put("style", it) }
                put("version", 1)
            }
            is ListNode -> buildJsonObject {
                put("type", "list")
                put("listType", node.listType)
                put("start", node.start)
                put("children", buildJsonArray { node.children.forEach { add(nodeToJsonElement(it)) } })
                put("direction", node.direction)
                put("version", 1)
            }
            is ListItemNode -> buildJsonObject {
                put("type", "listitem")
                put("value", node.value)
                node.checked?.let { put("checked", it) }
                put("children", buildJsonArray { node.children.forEach { add(nodeToJsonElement(it)) } })
                put("direction", node.direction)
                put("version", 1)
            }
            is QuoteNode -> buildJsonObject {
                put("type", "quote")
                put("children", buildJsonArray { node.children.forEach { add(nodeToJsonElement(it)) } })
                put("version", 1)
            }
            is CodeNode -> buildJsonObject {
                put("type", "code")
                node.language?.let { put("language", it) }
                put("children", buildJsonArray { node.children.forEach { add(nodeToJsonElement(it)) } })
                put("version", 1)
            }
            is TableNode -> buildJsonObject {
                put("type", "table")
                put("children", buildJsonArray { node.children.forEach { add(nodeToJsonElement(it)) } })
                put("version", 1)
            }
            is TableRowNode -> buildJsonObject {
                put("type", "tablerow")
                put("children", buildJsonArray { node.children.forEach { add(nodeToJsonElement(it)) } })
                put("version", 1)
            }
            is TableCellNode -> buildJsonObject {
                put("type", "tablecell")
                put("header", node.header)
                put("children", buildJsonArray { node.children.forEach { add(nodeToJsonElement(it)) } })
                put("version", 1)
            }
            is LinkNode -> buildJsonObject {
                put("type", "link")
                put("url", node.url)
                put("children", buildJsonArray { node.children.forEach { add(nodeToJsonElement(it)) } })
                put("version", 1)
            }
            is JournalImageNode -> buildJsonObject {
                put("type", "journal-image")
                put("assetId", node.assetId)
                node.width?.let { put("width", it) }
                node.height?.let { put("height", it) }
                put("alignment", node.alignment)
                put("caption", node.caption)
                put("displayMode", node.displayMode)
                put("version", 1)
            }
            is MentionNode -> buildJsonObject {
                put("type", "${node.mentionType}-mention")
                put("entityId", node.entityId)
                put("entityName", node.entityName)
                put("version", 1)
            }
            is LexicalRootNode -> buildRootJsonObject(node)
            is UnknownNode -> node.rawJson
        }
    }

    fun extractPlaintext(doc: LexicalDocument): String {
        val sb = StringBuilder()
        fun traverse(nodes: List<LexicalNode>) {
            for (node in nodes) {
                when (node) {
                    is TextNode -> sb.append(node.text)
                    is ParagraphNode -> {
                        traverse(node.children)
                        sb.append("\n")
                    }
                    is HeadingNode -> {
                        traverse(node.children)
                        sb.append("\n")
                    }
                    is ListItemNode -> {
                        sb.append("• ")
                        traverse(node.children)
                        sb.append("\n")
                    }
                    is ListNode -> traverse(node.children)
                    is QuoteNode -> {
                        traverse(node.children)
                        sb.append("\n")
                    }
                    is CodeNode -> traverse(node.children)
                    is LinkNode -> traverse(node.children)
                    is TableNode -> traverse(node.children)
                    is TableRowNode -> {
                        traverse(node.children)
                        sb.append("\n")
                    }
                    is TableCellNode -> {
                        traverse(node.children)
                        sb.append(" | ")
                    }
                    is MentionNode -> sb.append("@${node.entityName} ")
                    is JournalImageNode -> { if (node.caption.isNotBlank()) sb.append("[Image: ${node.caption}]\n") }
                    else -> {}
                }
            }
        }
        traverse(doc.root.children)
        return sb.toString().trim()
    }

    fun calculateWordCount(plaintext: String): Int {
        if (plaintext.isBlank()) return 0
        return plaintext.trim().split("\\s+".toRegex()).count { it.isNotEmpty() }
    }

    fun calculateReadingTime(wordCount: Int): Int {
        val wordsPerMinute = 200
        return Math.ceil(wordCount.toDouble() / wordsPerMinute).toInt().coerceAtLeast(1)
    }

    fun fromMarkdown(markdown: String): LexicalDocument {
        val lines = markdown.split("\n")
        val rootChildren = mutableListOf<LexicalNode>()

        for (line in lines) {
            val trimmed = line.trim()
            when {
                trimmed.startsWith("# ") -> {
                    val textNode = TextNode(text = trimmed.removePrefix("# "))
                    rootChildren.add(HeadingNode(tag = "h1", children = listOf(textNode)))
                }
                trimmed.startsWith("## ") -> {
                    val textNode = TextNode(text = trimmed.removePrefix("## "))
                    rootChildren.add(HeadingNode(tag = "h2", children = listOf(textNode)))
                }
                trimmed.startsWith("### ") -> {
                    val textNode = TextNode(text = trimmed.removePrefix("### "))
                    rootChildren.add(HeadingNode(tag = "h3", children = listOf(textNode)))
                }
                trimmed.startsWith("> ") -> {
                    val textNode = TextNode(text = trimmed.removePrefix("> "))
                    rootChildren.add(QuoteNode(children = listOf(textNode)))
                }
                trimmed.startsWith("- ") || trimmed.startsWith("* ") -> {
                    val textNode = TextNode(text = trimmed.removePrefix("- ").removePrefix("* "))
                    val item = ListItemNode(children = listOf(textNode))
                    rootChildren.add(ListNode(listType = "bullet", children = listOf(item)))
                }
                trimmed.isNotBlank() -> {
                    val textNode = TextNode(text = trimmed)
                    rootChildren.add(ParagraphNode(children = listOf(textNode)))
                }
            }
        }
        return LexicalDocument(root = LexicalRootNode(children = rootChildren))
    }
}
